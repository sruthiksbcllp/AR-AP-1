"use server"

import { revalidatePath } from "next/cache"

import {
  postCustomerInvoiceJournal,
  postCustomerReceiptJournal,
} from "@/lib/accounting/post"
import { requireOrgContext } from "@/lib/auth/org"
import {
  canRecordArPayment,
  canWriteAr,
  deniedMessage,
} from "@/lib/auth/roles"
import {
  calcLineTotal,
  nextInvoiceStatusAfterPayment,
  roundMoney,
  type CreateInvoiceInput,
  type InvoiceLineInput,
  type InvoiceStatus,
  type RecordInvoicePaymentInput,
} from "@/types/invoices"

export type ActionResult =
  | { success: true; id: string }
  | { success: false; error: string }

function parseDate(
  value: string,
  label: string
): { value: string } | { error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { error: `${label} must be a valid date.` }
  }
  return { value }
}

function parseLineItems(raw: unknown): InvoiceLineInput[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "Add at least one line item." }
  }

  const items: InvoiceLineInput[] = []

  for (const [index, row] of raw.entries()) {
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
    if (!Number.isInteger(quantity) || quantity < 1) {
      return {
        error: `Line item ${index + 1} quantity must be a whole number of 1 or more.`,
      }
    }
    if (!Number.isFinite(unit_price) || unit_price < 0) {
      return { error: `Line item ${index + 1} needs a valid unit rate.` }
    }
    if (!Number.isFinite(tax_rate) || tax_rate < 0 || tax_rate > 100) {
      return { error: `Line item ${index + 1} has an invalid tax rate.` }
    }

    items.push({
      description,
      quantity,
      unit_price: roundMoney(unit_price),
      tax_rate: roundMoney(tax_rate),
      line_total: calcLineTotal(quantity, unit_price, tax_rate),
    })
  }

  return items
}

export async function createInvoice(
  input: CreateInvoiceInput
): Promise<ActionResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }

  const { supabase, userId, orgId, role } = auth.ctx

  if (!canWriteAr(role)) {
    return { success: false, error: deniedMessage("create customer invoices") }
  }

  const customer_id = String(input.customer_id ?? "").trim()
  const invoice_number = String(input.invoice_number ?? "").trim()
  const status = input.status === "sent" ? "sent" : "draft"

  if (!customer_id) {
    return { success: false, error: "Select a customer." }
  }
  if (!invoice_number) {
    return { success: false, error: "Invoice number is required." }
  }

  const issue = parseDate(String(input.issue_date ?? ""), "Issue date")
  if ("error" in issue) return { success: false, error: issue.error }
  const issue_date = issue.value

  const due = parseDate(String(input.due_date ?? ""), "Due date")
  if ("error" in due) return { success: false, error: due.error }
  const due_date = due.value

  const items = parseLineItems(input.items)
  if ("error" in items) return { success: false, error: items.error }

  const total_amount = roundMoney(
    items.reduce((sum, item) => sum + item.line_total, 0)
  )

  if (total_amount <= 0) {
    return { success: false, error: "Invoice total must be greater than zero." }
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      org_id: orgId,
      customer_id,
      invoice_number,
      total_amount,
      balance_due: total_amount,
      status,
      issue_date,
      due_date,
    })
    .select("id")
    .single()

  if (invoiceError || !invoice) {
    return {
      success: false,
      error: invoiceError?.message ?? "Failed to create invoice.",
    }
  }

  const { error: itemsError } = await supabase.from("invoice_items").insert(
    items.map((item) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      line_total: item.line_total,
    }))
  )

  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", invoice.id)
    return {
      success: false,
      error: itemsError.message ?? "Failed to save invoice line items.",
    }
  }

  if (status === "sent") {
    const posted = await postCustomerInvoiceJournal(supabase, orgId, {
      invoiceId: invoice.id,
      invoiceNumber: invoice_number,
      issueDate: issue_date,
      items,
      total: total_amount,
    })
    if (!posted.ok) {
      await supabase.from("invoices").delete().eq("id", invoice.id)
      return { success: false, error: posted.error }
    }
  }

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    user_id: userId,
    action: "invoice.create",
    entity: "invoices",
    entity_id: invoice.id,
    changes_json: {
      after: {
        customer_id,
        invoice_number,
        total_amount,
        balance_due: total_amount,
        status,
        issue_date,
        due_date,
        items,
      },
    },
  })

  revalidatePath("/dashboard/ar")
  revalidatePath("/ar")

  return { success: true, id: invoice.id }
}

export async function recordInvoicePayment(
  input: RecordInvoicePaymentInput
): Promise<ActionResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }

  const { supabase, userId, orgId, role } = auth.ctx

  if (!canRecordArPayment(role)) {
    return { success: false, error: deniedMessage("record customer receipts") }
  }

  const invoice_id = String(input.invoice_id ?? "").trim()
  const payment_method = String(input.payment_method ?? "").trim()
  const reference_code = String(input.reference_code ?? "").trim()
  const amount = roundMoney(Number(input.amount))
  const paid_at = String(input.paid_at ?? "").trim()

  if (!invoice_id) {
    return { success: false, error: "Invoice is required." }
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Payment amount must be greater than zero." }
  }
  if (!payment_method) {
    return { success: false, error: "Payment method is required." }
  }
  if (!paid_at) {
    return { success: false, error: "Payment date is required." }
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, org_id, invoice_number, total_amount, balance_due, status")
    .eq("id", invoice_id)
    .maybeSingle()

  if (invoiceError || !invoice) {
    return {
      success: false,
      error: invoiceError?.message ?? "Invoice not found.",
    }
  }

  if (invoice.org_id !== orgId) {
    return { success: false, error: "Invoice not found in your organization." }
  }

  const total_amount = roundMoney(Number(invoice.total_amount))
  const currentBalance = roundMoney(Number(invoice.balance_due))

  if (currentBalance <= 0) {
    return { success: false, error: "This invoice is already fully paid." }
  }

  if (amount > currentBalance) {
    return {
      success: false,
      error: `Payment cannot exceed balance due (${currentBalance}).`,
    }
  }

  const nextBalance = roundMoney(currentBalance - amount)
  const previousStatus = invoice.status as InvoiceStatus
  const nextStatus = nextInvoiceStatusAfterPayment({
    totalAmount: total_amount,
    balanceDue: nextBalance,
    currentStatus: previousStatus,
  })

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      org_id: orgId,
      entity_type: "invoice",
      entity_id: invoice_id,
      amount,
      payment_method,
      reference_code: reference_code || null,
      paid_at: new Date(paid_at).toISOString(),
    })
    .select("id")
    .single()

  if (paymentError || !payment) {
    return {
      success: false,
      error: paymentError?.message ?? "Failed to record payment.",
    }
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      balance_due: nextBalance,
      status: nextStatus,
    })
    .eq("id", invoice_id)

  if (updateError) {
    await supabase.from("payments").delete().eq("id", payment.id)
    return {
      success: false,
      error: updateError.message ?? "Payment saved, but invoice update failed.",
    }
  }

  const paidOn = /^\d{4}-\d{2}-\d{2}/.test(paid_at)
    ? paid_at.slice(0, 10)
    : new Date(paid_at).toISOString().slice(0, 10)

  const posted = await postCustomerReceiptJournal(supabase, orgId, {
    paymentId: payment.id,
    invoiceNumber: String(invoice.invoice_number),
    amount,
    paidOn,
  })

  if (!posted.ok) {
    await supabase
      .from("invoices")
      .update({ balance_due: currentBalance, status: previousStatus })
      .eq("id", invoice_id)
    await supabase.from("payments").delete().eq("id", payment.id)
    return { success: false, error: posted.error }
  }

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    user_id: userId,
    action: "invoice.payment",
    entity: "invoices",
    entity_id: invoice_id,
    changes_json: {
      payment_id: payment.id,
      amount,
      payment_method,
      reference_code: reference_code || null,
      before: {
        balance_due: currentBalance,
        status: previousStatus,
      },
      after: {
        balance_due: nextBalance,
        status: nextStatus,
      },
    },
  })

  revalidatePath("/dashboard/ar")
  revalidatePath("/ar")

  return { success: true, id: payment.id }
}
