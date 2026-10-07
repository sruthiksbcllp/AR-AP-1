"use server"

import { revalidatePath } from "next/cache"

import { postVendorBillJournal } from "@/lib/accounting/post"
import { requireOrgContext } from "@/lib/auth/org"
import {
  canApproveBillAmount,
  canReviewApprovals,
  canWriteAp,
  deniedMessage,
} from "@/lib/auth/roles"
import {
  BILL_APPROVAL_THRESHOLD,
  calcLineTotal,
  resolveBillStatusOnSubmit,
  roundMoney,
  type BillLineInput,
  type BillStatus,
} from "@/types/bills"

export type ActionResult =
  | { success: true; id: string }
  | { success: false; error: string }

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

function parseDate(
  value: string,
  label: string
): { value: string } | { error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { error: `${label} must be a valid date.` }
  }
  return { value }
}

function parseLineItemsJson(
  raw: string
): BillLineInput[] | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: "Line items payload is invalid." }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { error: "Add at least one line item." }
  }

  const items: BillLineInput[] = []

  for (const [index, row] of parsed.entries()) {
    if (!row || typeof row !== "object") {
      return { error: `Line item ${index + 1} is invalid.` }
    }

    const description = String(
      (row as { description?: unknown }).description ?? ""
    ).trim()
    const quantity = Number((row as { quantity?: unknown }).quantity)
    const unit_price = Number((row as { unit_price?: unknown }).unit_price)
    const tax_rate = Number((row as { tax_rate?: unknown }).tax_rate ?? 0)

    if (!description) {
      return { error: `Line item ${index + 1} needs a description.` }
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: `Line item ${index + 1} needs a positive quantity.` }
    }
    if (!Number.isFinite(unit_price) || unit_price < 0) {
      return { error: `Line item ${index + 1} needs a valid unit rate.` }
    }
    if (!Number.isFinite(tax_rate) || tax_rate < 0 || tax_rate > 100) {
      return { error: `Line item ${index + 1} has an invalid tax rate.` }
    }

    items.push({
      description,
      quantity: roundMoney(quantity),
      unit_price: roundMoney(unit_price),
      tax_rate: roundMoney(tax_rate),
      line_total: calcLineTotal(quantity, unit_price, tax_rate),
    })
  }

  return items
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)
}

export async function createBill(formData: FormData): Promise<ActionResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }

  const { supabase, userId, orgId, role } = auth.ctx

  if (!canWriteAp(role)) {
    return { success: false, error: deniedMessage("create vendor bills") }
  }

  const vendor_id = String(formData.get("vendor_id") ?? "").trim()
  const bill_number = String(formData.get("bill_number") ?? "").trim()
  const saveAsDraft = String(formData.get("save_as_draft") ?? "") === "true"
  const due = parseDate(String(formData.get("due_date") ?? ""), "Due date")
  if ("error" in due) return { success: false, error: due.error }

  if (!vendor_id) return { success: false, error: "Select a vendor." }
  if (!bill_number) return { success: false, error: "Bill number is required." }

  const items = parseLineItemsJson(String(formData.get("items") ?? "[]"))
  if ("error" in items) return { success: false, error: items.error }

  const total_amount = roundMoney(
    items.reduce((sum, item) => sum + item.line_total, 0)
  )

  if (total_amount <= 0) {
    return { success: false, error: "Bill total must be greater than zero." }
  }

  const status: BillStatus = saveAsDraft
    ? "draft"
    : resolveBillStatusOnSubmit(total_amount)

  const file = formData.get("attachment")
  let attachment_path: string | null = null
  let attachment_name: string | null = null
  let attachment_mime: string | null = null

  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: "Attachment must be 10MB or smaller." }
    }
    if (file.type && !ALLOWED_MIME.has(file.type)) {
      return {
        success: false,
        error: "Attachment must be a PDF, image, or Word document.",
      }
    }

    const safeName = sanitizeFilename(file.name || "vendor-invoice.pdf")
    const objectPath = `${orgId}/${Date.now()}-${safeName}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from("vendor-invoices")
      .upload(objectPath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      })

    if (uploadError) {
      return {
        success: false,
        error: `File upload failed: ${uploadError.message}`,
      }
    }

    attachment_path = objectPath
    attachment_name = file.name
    attachment_mime = file.type || null
  }

  const { data: bill, error: billError } = await supabase
    .from("bills")
    .insert({
      org_id: orgId,
      vendor_id,
      bill_number,
      total_amount,
      balance_due: total_amount,
      status,
      due_date: due.value,
      attachment_path,
      attachment_name,
      attachment_mime,
    })
    .select("id")
    .single()

  if (billError || !bill) {
    if (attachment_path) {
      await supabase.storage.from("vendor-invoices").remove([attachment_path])
    }
    return {
      success: false,
      error: billError?.message ?? "Failed to create bill.",
    }
  }

  const { error: itemsError } = await supabase.from("bill_items").insert(
    items.map((item) => ({
      bill_id: bill.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      line_total: item.line_total,
    }))
  )

  if (itemsError) {
    await supabase.from("bills").delete().eq("id", bill.id)
    if (attachment_path) {
      await supabase.storage.from("vendor-invoices").remove([attachment_path])
    }
    return {
      success: false,
      error: itemsError.message ?? "Failed to save bill line items.",
    }
  }

  if (status === "approved") {
    const posted = await postVendorBillJournal(supabase, orgId, {
      billId: bill.id,
      billNumber: bill_number,
      items,
      total: total_amount,
    })
    if (!posted.ok) {
      await supabase.from("bills").delete().eq("id", bill.id)
      if (attachment_path) {
        await supabase.storage.from("vendor-invoices").remove([attachment_path])
      }
      return { success: false, error: posted.error }
    }
  }

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    user_id: userId,
    action: "bill.create",
    entity: "bills",
    entity_id: bill.id,
    changes_json: {
      after: {
        vendor_id,
        bill_number,
        total_amount,
        balance_due: total_amount,
        status,
        due_date: due.value,
        attachment_path,
        attachment_name,
        approval_threshold: BILL_APPROVAL_THRESHOLD,
        items,
      },
    },
  })

  revalidatePath("/dashboard/ap")
  revalidatePath("/dashboard/approvals")
  revalidatePath("/ap")
  revalidatePath("/approvals")

  return { success: true, id: bill.id }
}

export async function decideBillApproval(input: {
  bill_id: string
  decision: "approved" | "rejected"
  comments: string
}): Promise<ActionResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }

  const { supabase, userId, orgId, role } = auth.ctx

  if (!canReviewApprovals(role)) {
    return {
      success: false,
      error: deniedMessage("approve or reject bills"),
    }
  }

  const bill_id = String(input.bill_id ?? "").trim()
  const comments = String(input.comments ?? "").trim()
  const decision = input.decision

  if (!bill_id) return { success: false, error: "Bill is required." }
  if (!comments) {
    return { success: false, error: "Feedback comments are required." }
  }
  if (decision !== "approved" && decision !== "rejected") {
    return { success: false, error: "Invalid approval decision." }
  }

  const { data: bill, error: billError } = await supabase
    .from("bills")
    .select("id, org_id, status, total_amount, balance_due, bill_number")
    .eq("id", bill_id)
    .maybeSingle()

  if (billError || !bill) {
    return { success: false, error: billError?.message ?? "Bill not found." }
  }

  if (bill.org_id !== orgId) {
    return { success: false, error: "Bill not found in your organization." }
  }

  if (bill.status !== "pending_approval") {
    return {
      success: false,
      error: "Only bills pending approval can be reviewed.",
    }
  }

  const amount = Number(bill.total_amount) || 0
  if (!canApproveBillAmount(role, amount)) {
    return {
      success: false,
      error: `Managers can approve bills up to ₹50,000. Director / CFO approval is required for this amount.`,
    }
  }

  const nextStatus: BillStatus =
    decision === "approved" ? "approved" : "rejected"

  const { error: updateError } = await supabase
    .from("bills")
    .update({ status: nextStatus })
    .eq("id", bill_id)

  if (updateError) {
    return {
      success: false,
      error: updateError.message ?? "Failed to update bill status.",
    }
  }

  const { data: approval, error: approvalError } = await supabase
    .from("approval_logs")
    .insert({
      bill_id,
      approved_by_user_id: userId,
      status: decision,
      comments,
    })
    .select("id")
    .single()

  if (approvalError || !approval) {
    // Roll status back if audit trail insert fails
    await supabase
      .from("bills")
      .update({ status: "pending_approval" })
      .eq("id", bill_id)
    return {
      success: false,
      error: approvalError?.message ?? "Failed to write approval log.",
    }
  }

  if (decision === "approved") {
    const { data: billItems, error: billItemsError } = await supabase
      .from("bill_items")
      .select("quantity, unit_price")
      .eq("bill_id", bill_id)

    if (billItemsError || !billItems?.length) {
      await supabase.from("approval_logs").delete().eq("id", approval.id)
      await supabase
        .from("bills")
        .update({ status: "pending_approval" })
        .eq("id", bill_id)
      return {
        success: false,
        error: billItemsError?.message ?? "Bill has no lines to post.",
      }
    }

    const posted = await postVendorBillJournal(supabase, orgId, {
      billId: bill_id,
      billNumber: bill.bill_number as string,
      items: billItems.map((item) => ({
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
      })),
      total: Number(bill.total_amount),
    })

    if (!posted.ok) {
      await supabase.from("approval_logs").delete().eq("id", approval.id)
      await supabase
        .from("bills")
        .update({ status: "pending_approval" })
        .eq("id", bill_id)
      return { success: false, error: posted.error }
    }
  }

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    user_id: userId,
    action: `bill.${decision}`,
    entity: "bills",
    entity_id: bill_id,
    changes_json: {
      approval_log_id: approval.id,
      comments,
      before: { status: "pending_approval" },
      after: { status: nextStatus },
    },
  })

  revalidatePath("/dashboard/ap")
  revalidatePath("/dashboard/approvals")
  revalidatePath("/ap")
  revalidatePath("/approvals")

  return { success: true, id: approval.id }
}
