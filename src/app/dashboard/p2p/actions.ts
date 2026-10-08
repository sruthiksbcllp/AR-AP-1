"use server"

import { revalidatePath } from "next/cache"

import { postJournal, revalidateAccounting } from "@/lib/accounting/post"
import { ACCOUNT_CODES } from "@/lib/accounting/codes"
import { requireOrgContext } from "@/lib/auth/org"
import {
  canApprovePayment,
  canApprovePoAmount,
  canApprovePr,
  canCreateGrn,
  canCreatePo,
  canCreatePr,
  canCreateSes,
  canMatchInvoice,
  canPayVendor,
  canProposePayment,
  canReviewSes,
  canWriteCatalog,
  deniedMessage,
} from "@/lib/auth/roles"
import { nextDocNumber } from "@/lib/p2p/numbers"
import { calcLineTotal, roundMoney } from "@/types/bills"

export type P2pResult =
  | { success: true; id: string }
  | { success: false; error: string }

function revalidateP2p(extra: string[] = []) {
  for (const path of [
    "/dashboard/p2p",
    "/dashboard/p2p/items",
    "/dashboard/p2p/pr",
    "/dashboard/p2p/po",
    "/dashboard/p2p/grn",
    "/dashboard/p2p/ses",
    "/dashboard/p2p/match",
    "/dashboard/p2p/payments",
    "/dashboard/rfq",
    "/dashboard/ap",
    "/dashboard/approvals",
    ...extra,
  ]) {
    revalidatePath(path)
  }
}

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim()
}

export async function saveCatalogItem(formData: FormData): Promise<P2pResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!canWriteCatalog(auth.ctx.role)) {
    return { success: false, error: deniedMessage("maintain the item catalog") }
  }
  const id = field(formData, "id")
  const sku = field(formData, "sku").toUpperCase()
  const name = field(formData, "name")
  const description = field(formData, "description")
  const category = field(formData, "category") || "general"
  const item_kind = field(formData, "item_kind") === "service" ? "service" : "goods"
  const unit = field(formData, "unit") || "each"
  const standard_cost = roundMoney(Number(field(formData, "standard_cost") || "0"))
  if (!sku || !name) return { success: false, error: "SKU and name are required." }
  if (!Number.isFinite(standard_cost) || standard_cost < 0) {
    return { success: false, error: "Standard cost must be zero or more." }
  }
  const payload = {
    org_id: auth.ctx.orgId,
    sku,
    name,
    description: description || null,
    category,
    item_kind,
    unit,
    standard_cost,
    is_active: field(formData, "is_active") !== "false",
  }
  const query = id
    ? auth.ctx.supabase.from("catalog_items").update(payload).eq("id", id).select("id").single()
    : auth.ctx.supabase.from("catalog_items").insert(payload).select("id").single()
  const { data, error } = await query
  if (error || !data) return { success: false, error: error?.message ?? "Could not save item." }
  revalidateP2p([`/dashboard/p2p/items/${data.id}`])
  return { success: true, id: data.id }
}

export async function createPurchaseRequisition(formData: FormData): Promise<P2pResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!canCreatePr(auth.ctx.role)) {
    return { success: false, error: deniedMessage("raise a purchase requisition") }
  }
  const department = field(formData, "department")
  const cost_center = field(formData, "cost_center")
  const justification = field(formData, "business_justification")
  const need_by_date = field(formData, "need_by_date") || null
  const vendor_id = field(formData, "vendor_id")
  const item_id = field(formData, "item_id")
  const description = field(formData, "description")
  const quantity = Number(field(formData, "quantity"))
  const estimated_unit_cost = roundMoney(Number(field(formData, "estimated_unit_cost") || "0"))
  if (!department || !cost_center || justification.length < 8) {
    return { success: false, error: "Department, cost center, and a business justification are required." }
  }
  if (!vendor_id) {
    return { success: false, error: "Select the onboarded vendor for this requisition." }
  }
  const { data: vendor } = await auth.ctx.supabase
    .from("contacts")
    .select("id, type, vendor_status")
    .eq("id", vendor_id)
    .maybeSingle()
  if (
    !vendor ||
    vendor.type !== "vendor" ||
    vendor.vendor_status === "rejected" ||
    vendor.vendor_status == null
  ) {
    return {
      success: false,
      error: "Select a vendor that has been submitted through Vendor Onboarding.",
    }
  }
  if (!description || !Number.isFinite(quantity) || quantity <= 0) {
    return { success: false, error: "Add an item description and a positive quantity." }
  }
  const line_total = roundMoney(quantity * estimated_unit_cost)
  const pr_number = await nextDocNumber(
    auth.ctx.supabase,
    "purchase_requisitions",
    "pr_number",
    "PR",
    auth.ctx.orgId
  )
  const { data, error } = await auth.ctx.supabase
    .from("purchase_requisitions")
    .insert({
      org_id: auth.ctx.orgId,
      pr_number,
      department,
      cost_center,
      requester_id: auth.ctx.userId,
      vendor_id,
      need_by_date,
      business_justification: justification,
      estimated_cost: line_total,
      status: "pending_manager",
    })
    .select("id")
    .single()
  if (error || !data) return { success: false, error: error?.message ?? "Could not create the PR." }
  await auth.ctx.supabase.from("pr_lines").insert({
    pr_id: data.id,
    item_id: item_id || null,
    description,
    quantity,
    estimated_unit_cost,
    line_total,
  })
  revalidateP2p([`/dashboard/p2p/pr/${data.id}`])
  return { success: true, id: data.id }
}

export async function decidePurchaseRequisition(input: {
  id: string
  decision: "approved" | "rejected"
}): Promise<P2pResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!canApprovePr(auth.ctx.role)) {
    return { success: false, error: deniedMessage("approve purchase requisitions") }
  }
  const next = input.decision === "approved" ? "approved" : "rejected"
  const { error } = await auth.ctx.supabase
    .from("purchase_requisitions")
    .update({ status: next })
    .eq("id", input.id)
    .eq("status", "pending_manager")
  if (error) return { success: false, error: error.message }
  revalidateP2p([`/dashboard/p2p/pr/${input.id}`])
  return { success: true, id: input.id }
}

export async function createPurchaseOrder(formData: FormData): Promise<P2pResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!canCreatePo(auth.ctx.role)) {
    return { success: false, error: deniedMessage("create a purchase order") }
  }
  const vendor_id = field(formData, "vendor_id")
  const pr_id = field(formData, "pr_id") || null
  const rfq_id = field(formData, "rfq_id") || null
  const payment_terms = field(formData, "payment_terms") || "Net 30"
  const delivery_date = field(formData, "delivery_date") || null
  const item_id = field(formData, "item_id") || null
  const description = field(formData, "description")
  const quantity = Number(field(formData, "quantity"))
  const rate = roundMoney(Number(field(formData, "rate") || "0"))
  const tax_rate = roundMoney(Number(field(formData, "tax_rate") || "18"))
  if (!vendor_id || !description || !Number.isFinite(quantity) || quantity <= 0) {
    return { success: false, error: "Vendor, item, and quantity are required." }
  }
  const { data: vendor } = await auth.ctx.supabase
    .from("contacts")
    .select("id, type, vendor_status")
    .eq("id", vendor_id)
    .maybeSingle()
  if (!vendor || vendor.type !== "vendor" || vendor.vendor_status !== "active") {
    return { success: false, error: "Select an active onboarded vendor." }
  }
  const line_total = calcLineTotal(quantity, rate, tax_rate)
  const net = roundMoney(quantity * rate)
  const tax_amount = roundMoney(line_total - net)
  const status = canApprovePoAmount(auth.ctx.role, line_total)
    ? "released"
    : "pending_approval"
  const po_number = await nextDocNumber(
    auth.ctx.supabase,
    "purchase_orders",
    "po_number",
    "PO",
    auth.ctx.orgId
  )
  const { data, error } = await auth.ctx.supabase
    .from("purchase_orders")
    .insert({
      org_id: auth.ctx.orgId,
      po_number,
      vendor_id,
      pr_id,
      rfq_id,
      payment_terms,
      delivery_date,
      tax_amount,
      total_amount: line_total,
      status,
      created_by: auth.ctx.userId,
    })
    .select("id")
    .single()
  if (error || !data) return { success: false, error: error?.message ?? "Could not create the PO." }
  await auth.ctx.supabase.from("po_lines").insert({
    po_id: data.id,
    item_id,
    description,
    quantity,
    rate,
    tax_rate,
    line_total,
  })
  if (pr_id) {
    await auth.ctx.supabase
      .from("purchase_requisitions")
      .update({ status: "ordered" })
      .eq("id", pr_id)
  }
  revalidateP2p([`/dashboard/p2p/po/${data.id}`])
  return { success: true, id: data.id }
}

export async function decidePurchaseOrder(input: {
  id: string
  decision: "approved" | "rejected"
}): Promise<P2pResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  const { data: po } = await auth.ctx.supabase
    .from("purchase_orders")
    .select("id, total_amount, status")
    .eq("id", input.id)
    .maybeSingle()
  if (!po) return { success: false, error: "Purchase order not found." }
  if (po.status !== "pending_approval") {
    return { success: false, error: "This PO is not waiting for approval." }
  }
  if (input.decision === "approved" && !canApprovePoAmount(auth.ctx.role, Number(po.total_amount))) {
    return { success: false, error: deniedMessage("approve a PO of this value") }
  }
  const next = input.decision === "approved" ? "released" : "rejected"
  const { error } = await auth.ctx.supabase
    .from("purchase_orders")
    .update({ status: next })
    .eq("id", input.id)
  if (error) return { success: false, error: error.message }
  revalidateP2p([`/dashboard/p2p/po/${input.id}`])
  return { success: true, id: input.id }
}

export async function createGoodsReceipt(formData: FormData): Promise<P2pResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!canCreateGrn(auth.ctx.role)) {
    return { success: false, error: deniedMessage("record a goods receipt") }
  }
  const po_id = field(formData, "po_id")
  const warehouse = field(formData, "warehouse") || "Main warehouse"
  const receipt_date = field(formData, "receipt_date") || new Date().toISOString().slice(0, 10)
  const po_line_id = field(formData, "po_line_id")
  const received_qty = Number(field(formData, "received_qty"))
  const rejected_qty = Number(field(formData, "rejected_qty") || "0")
  if (!po_id || !po_line_id) return { success: false, error: "Select a released PO line." }
  const { data: po } = await auth.ctx.supabase
    .from("purchase_orders")
    .select("id, status")
    .eq("id", po_id)
    .maybeSingle()
  if (!po || (po.status !== "released" && po.status !== "approved")) {
    return { success: false, error: "GRN can only be recorded against a released PO." }
  }
  const grn_number = await nextDocNumber(
    auth.ctx.supabase,
    "goods_receipts",
    "grn_number",
    "GRN",
    auth.ctx.orgId
  )
  const { data, error } = await auth.ctx.supabase
    .from("goods_receipts")
    .insert({
      org_id: auth.ctx.orgId,
      grn_number,
      po_id,
      warehouse,
      receipt_date,
      created_by: auth.ctx.userId,
    })
    .select("id")
    .single()
  if (error || !data) return { success: false, error: error?.message ?? "Could not create the GRN." }
  await auth.ctx.supabase.from("grn_lines").insert({
    grn_id: data.id,
    po_line_id,
    received_qty: Number.isFinite(received_qty) ? received_qty : 0,
    rejected_qty: Number.isFinite(rejected_qty) ? rejected_qty : 0,
  })
  revalidateP2p([`/dashboard/p2p/grn/${data.id}`])
  return { success: true, id: data.id }
}

export async function createServiceEntry(formData: FormData): Promise<P2pResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!canCreateSes(auth.ctx.role)) {
    return { success: false, error: deniedMessage("record a service entry") }
  }
  const po_id = field(formData, "po_id")
  const description = field(formData, "description")
  const amount = roundMoney(Number(field(formData, "amount") || "0"))
  if (!po_id || description.length < 3 || amount <= 0) {
    return { success: false, error: "PO, service description, and amount are required." }
  }
  const ses_number = await nextDocNumber(
    auth.ctx.supabase,
    "service_entries",
    "ses_number",
    "SES",
    auth.ctx.orgId
  )
  const { data, error } = await auth.ctx.supabase
    .from("service_entries")
    .insert({
      org_id: auth.ctx.orgId,
      ses_number,
      po_id,
      description,
      amount,
      status: "performed",
      created_by: auth.ctx.userId,
    })
    .select("id")
    .single()
  if (error || !data) return { success: false, error: error?.message ?? "Could not create the SES." }
  revalidateP2p([`/dashboard/p2p/ses/${data.id}`])
  return { success: true, id: data.id }
}

export async function advanceServiceEntry(id: string): Promise<P2pResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  const { data: ses } = await auth.ctx.supabase
    .from("service_entries")
    .select("id, status")
    .eq("id", id)
    .maybeSingle()
  if (!ses) return { success: false, error: "Service entry not found." }
  if (!canReviewSes(auth.ctx.role, String(ses.status))) {
    return { success: false, error: deniedMessage("advance this service entry") }
  }
  const next =
    ses.status === "performed"
      ? "confirmed"
      : ses.status === "confirmed"
        ? "manager_review"
        : ses.status === "manager_review"
          ? "approved"
          : null
  if (!next) return { success: false, error: "This SES cannot be advanced." }
  const { error } = await auth.ctx.supabase
    .from("service_entries")
    .update({ status: next })
    .eq("id", id)
  if (error) return { success: false, error: error.message }
  revalidateP2p()
  return { success: true, id }
}

export async function runThreeWayMatch(billId: string): Promise<P2pResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!canMatchInvoice(auth.ctx.role)) {
    return { success: false, error: deniedMessage("run three-way matching") }
  }
  const { data: bill } = await auth.ctx.supabase
    .from("bills")
    .select("id, po_id, bill_number")
    .eq("id", billId)
    .maybeSingle()
  if (!bill?.po_id) return { success: false, error: "This invoice has no PO reference." }
  const { data: poLines } = await auth.ctx.supabase
    .from("po_lines")
    .select("id, quantity")
    .eq("po_id", bill.po_id)
  const poQty = (poLines ?? []).reduce((sum, line) => sum + Number(line.quantity), 0)
  const { data: grns } = await auth.ctx.supabase
    .from("goods_receipts")
    .select("id")
    .eq("po_id", bill.po_id)
  const grnIds = (grns ?? []).map((row) => row.id)
  let grnQty = 0
  let grnId: string | null = grnIds[0] ?? null
  if (grnIds.length) {
    const { data: grnLines } = await auth.ctx.supabase
      .from("grn_lines")
      .select("received_qty")
      .in("grn_id", grnIds)
    grnQty = (grnLines ?? []).reduce((sum, line) => sum + Number(line.received_qty), 0)
  }
  const { data: billItems } = await auth.ctx.supabase
    .from("bill_items")
    .select("quantity")
    .eq("bill_id", billId)
  const invoiceQty = (billItems ?? []).reduce((sum, line) => sum + Number(line.quantity), 0)
  const pass = poQty > 0 && poQty === grnQty && grnQty === invoiceQty
  const status = pass ? "pass" : "exception"
  const { data, error } = await auth.ctx.supabase
    .from("three_way_matches")
    .upsert(
      {
        org_id: auth.ctx.orgId,
        bill_id: billId,
        po_id: bill.po_id,
        grn_id: grnId,
        status,
        po_qty: poQty,
        grn_qty: grnQty,
        invoice_qty: invoiceQty,
        exception_stage: pass ? "closed" : "procurement",
      },
      { onConflict: "bill_id" }
    )
    .select("id")
    .single()
  if (error || !data) return { success: false, error: error?.message ?? "Match failed." }
  await auth.ctx.supabase
    .from("bills")
    .update({ match_status: status })
    .eq("id", billId)
  revalidateP2p()
  return { success: true, id: data.id }
}

export async function advanceMatchException(id: string): Promise<P2pResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  const { data: match } = await auth.ctx.supabase
    .from("three_way_matches")
    .select("id, status, exception_stage, bill_id")
    .eq("id", id)
    .maybeSingle()
  if (!match || match.status !== "exception") {
    return { success: false, error: "This match is not in exception." }
  }
  if (match.exception_stage === "procurement") {
    if (auth.ctx.role !== "admin" && auth.ctx.role !== "procurement") {
      return { success: false, error: deniedMessage("review this match exception") }
    }
    await auth.ctx.supabase
      .from("three_way_matches")
      .update({ exception_stage: "finance" })
      .eq("id", id)
  } else if (match.exception_stage === "finance") {
    if (auth.ctx.role !== "admin" && auth.ctx.role !== "finance") {
      return { success: false, error: deniedMessage("close this match exception") }
    }
    await auth.ctx.supabase
      .from("three_way_matches")
      .update({ exception_stage: "closed", status: "pass" })
      .eq("id", id)
    await auth.ctx.supabase
      .from("bills")
      .update({ match_status: "waived" })
      .eq("id", match.bill_id)
  }
  revalidateP2p()
  return { success: true, id }
}

export async function createPaymentProposal(formData: FormData): Promise<P2pResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!canProposePayment(auth.ctx.role)) {
    return { success: false, error: deniedMessage("propose a vendor payment") }
  }
  const bill_id = field(formData, "bill_id")
  const { data: bill } = await auth.ctx.supabase
    .from("bills")
    .select("id, balance_due, on_hold, match_status, status")
    .eq("id", bill_id)
    .maybeSingle()
  if (!bill) return { success: false, error: "Invoice not found." }
  if (bill.on_hold) return { success: false, error: "This invoice is on hold." }
  if (bill.match_status === "exception") {
    return { success: false, error: "Resolve the three-way match exception first." }
  }
  const amount = roundMoney(Number(bill.balance_due))
  if (amount <= 0) return { success: false, error: "Nothing is outstanding on this invoice." }
  const { data, error } = await auth.ctx.supabase
    .from("payment_proposals")
    .insert({
      org_id: auth.ctx.orgId,
      bill_id,
      amount,
      status: "proposed",
      notes: field(formData, "notes") || null,
      created_by: auth.ctx.userId,
    })
    .select("id")
    .single()
  if (error || !data) return { success: false, error: error?.message ?? "Could not create the proposal." }
  revalidateP2p()
  return { success: true, id: data.id }
}

export async function advancePaymentProposal(id: string): Promise<P2pResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  const { data: row } = await auth.ctx.supabase
    .from("payment_proposals")
    .select("id, status, amount, bill_id")
    .eq("id", id)
    .maybeSingle()
  if (!row) return { success: false, error: "Payment proposal not found." }
  if (row.status === "proposed") {
    if (!canApprovePayment(auth.ctx.role)) {
      return { success: false, error: deniedMessage("approve this payment") }
    }
    await auth.ctx.supabase
      .from("payment_proposals")
      .update({ status: "finance_approved" })
      .eq("id", id)
    revalidateP2p()
    return { success: true, id }
  }
  if (row.status === "finance_approved") {
    if (!canPayVendor(auth.ctx.role)) {
      return { success: false, error: deniedMessage("record the bank payment") }
    }
    await auth.ctx.supabase.from("payment_proposals").update({ status: "paid" }).eq("id", id)
    revalidateP2p()
    return { success: true, id }
  }
  if (row.status === "paid") {
    if (!canPayVendor(auth.ctx.role)) {
      return { success: false, error: deniedMessage("confirm this payment") }
    }
    const { data: bill } = await auth.ctx.supabase
      .from("bills")
      .select("id, bill_number, balance_due, total_amount, po_id")
      .eq("id", row.bill_id)
      .maybeSingle()
    if (bill) {
      await auth.ctx.supabase.from("payments").insert({
        org_id: auth.ctx.orgId,
        entity_type: "bill",
        entity_id: bill.id,
        amount: row.amount,
        payment_method: "bank",
        reference_code: `PMT-${id.slice(0, 8)}`,
      })
      const remaining = roundMoney(Number(bill.balance_due) - Number(row.amount))
      await auth.ctx.supabase
        .from("bills")
        .update({
          balance_due: Math.max(remaining, 0),
          status: remaining <= 0 ? "paid" : "partially_paid",
        })
        .eq("id", bill.id)
      const { data: accounts } = await auth.ctx.supabase
        .from("accounts")
        .select("id, code")
        .in("code", [ACCOUNT_CODES.accountsPayable, ACCOUNT_CODES.bank])
        .eq("is_group", false)
      const ap = accounts?.find((account) => account.code === ACCOUNT_CODES.accountsPayable)?.id
      const bank = accounts?.find((account) => account.code === ACCOUNT_CODES.bank)?.id
      if (ap && bank) {
        await postJournal(auth.ctx.supabase, {
          postingDate: new Date().toISOString().slice(0, 10),
          description: `Vendor payment ${bill.bill_number}`.slice(0, 200),
          source: "ap_payment",
          sourceId: id,
          lines: [
            { account_id: ap, description: `AP ${bill.bill_number}`, debit: Number(row.amount), credit: 0 },
            { account_id: bank, description: `Bank ${bill.bill_number}`, debit: 0, credit: Number(row.amount) },
          ],
        })
        revalidateAccounting()
      }
    }
    if (bill?.po_id) {
      await auth.ctx.supabase
        .from("purchase_orders")
        .update({ status: "closed" })
        .eq("id", bill.po_id)
    }
    await auth.ctx.supabase.from("payment_proposals").update({ status: "confirmed" }).eq("id", id)
    revalidateP2p()
    return { success: true, id }
  }
  return { success: false, error: "This payment cannot be advanced." }
}

export async function toggleBillHold(billId: string): Promise<P2pResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!canProposePayment(auth.ctx.role)) {
    return { success: false, error: deniedMessage("hold vendor invoices") }
  }
  const { data: bill } = await auth.ctx.supabase
    .from("bills")
    .select("id, on_hold")
    .eq("id", billId)
    .maybeSingle()
  if (!bill) return { success: false, error: "Invoice not found." }
  await auth.ctx.supabase.from("bills").update({ on_hold: !bill.on_hold }).eq("id", billId)
  revalidatePath("/dashboard/ap")
  revalidateP2p()
  return { success: true, id: billId }
}
