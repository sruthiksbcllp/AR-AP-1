"use server"

import { revalidatePath } from "next/cache"

import { requireOrgContext } from "@/lib/auth/org"
import { canCreateRfq, canEvaluateRfq, canQuoteRfq, deniedMessage } from "@/lib/auth/roles"
import { roundMoney } from "@/types/bills"

export type RfqActionResult =
  | { success: true; id: string }
  | { success: false; error: string }

export async function createRfq(formData: FormData): Promise<RfqActionResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }

  const title = String(formData.get("title") ?? "")
    .trim()
    .replace(/\s+/g, " ")
  if (title.length < 3) {
    return { success: false, error: "Describe what you need in at least 3 characters." }
  }
  if (title.length > 160) {
    return { success: false, error: "Keep the request under 160 characters." }
  }

  const { supabase, orgId, userId, role } = auth.ctx
  if (!canCreateRfq(role)) {
    return { success: false, error: deniedMessage("create a request for quotation") }
  }
  const { data, error } = await supabase
    .from("rfqs")
    .insert({
      org_id: orgId,
      title,
      created_by: userId,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? "Could not create the request." }
  }

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    user_id: userId,
    action: "rfq.create",
    entity: "rfqs",
    entity_id: data.id,
    changes_json: { after: { title } },
  })

  revalidatePath("/dashboard/rfq")
  return { success: true, id: data.id }
}

export async function addRfqQuote(formData: FormData): Promise<RfqActionResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }

  const rfqId = String(formData.get("rfq_id") ?? "")
  const vendorId = String(formData.get("vendor_id") ?? "")
  const amount = roundMoney(Number(String(formData.get("amount") ?? "").replace(/,/g, "")))
  if (!rfqId || !vendorId) {
    return { success: false, error: "Choose a vendor and enter the quoted amount." }
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Quoted amount must be greater than zero." }
  }

  const { supabase, orgId, userId, role } = auth.ctx
  if (!canQuoteRfq(role)) {
    return { success: false, error: deniedMessage("record vendor quotes") }
  }
  const { data: rfq, error: rfqError } = await supabase
    .from("rfqs")
    .select("id, status")
    .eq("id", rfqId)
    .maybeSingle()
  if (rfqError || !rfq) {
    return { success: false, error: rfqError?.message ?? "Request not found." }
  }
  if (rfq.status !== "open") {
    return { success: false, error: "This request is already evaluated." }
  }

  const { data, error } = await supabase
    .from("rfq_quotes")
    .insert({ rfq_id: rfqId, vendor_id: vendorId, amount })
    .select("id")
    .single()

  if (error || !data) {
    const duplicate = error?.code === "23505"
    return {
      success: false,
      error: duplicate
        ? "This vendor already has a quote on this request."
        : (error?.message ?? "Could not save the quote."),
    }
  }

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    user_id: userId,
    action: "rfq.quote",
    entity: "rfq_quotes",
    entity_id: data.id,
    changes_json: { after: { rfq_id: rfqId, vendor_id: vendorId, amount } },
  })

  revalidatePath("/dashboard/rfq")
  revalidatePath(`/dashboard/rfq/${rfqId}`)
  return { success: true, id: data.id }
}

export async function selectLowestQuote(formData: FormData): Promise<RfqActionResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }

  const rfqId = String(formData.get("rfq_id") ?? "")
  if (!rfqId) return { success: false, error: "Request not found." }

  const { supabase, orgId, userId, role } = auth.ctx
  if (!canEvaluateRfq(role)) {
    return { success: false, error: deniedMessage("select a winning quote") }
  }
  const { data: rfq, error: rfqError } = await supabase
    .from("rfqs")
    .select("id, status, title")
    .eq("id", rfqId)
    .maybeSingle()
  if (rfqError || !rfq) {
    return { success: false, error: rfqError?.message ?? "Request not found." }
  }
  if (rfq.status !== "open") {
    return { success: false, error: "This request is already evaluated." }
  }

  const { data: quotes, error: quotesError } = await supabase
    .from("rfq_quotes")
    .select("id, amount, created_at")
    .eq("rfq_id", rfqId)
  if (quotesError) return { success: false, error: quotesError.message }
  if (!quotes?.length) {
    return { success: false, error: "Add at least one vendor quote before evaluating." }
  }

  const winner = quotes.reduce((best, quote) => {
    if (Number(quote.amount) < Number(best.amount)) return quote
    if (Number(quote.amount) === Number(best.amount) && quote.created_at < best.created_at) {
      return quote
    }
    return best
  })

  const { error } = await supabase
    .from("rfqs")
    .update({ status: "evaluated", selected_quote_id: winner.id })
    .eq("id", rfqId)
    .eq("status", "open")
  if (error) return { success: false, error: error.message }

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    user_id: userId,
    action: "rfq.evaluate",
    entity: "rfqs",
    entity_id: rfqId,
    changes_json: {
      after: { title: rfq.title, selected_quote_id: winner.id, amount: winner.amount },
    },
  })

  revalidatePath("/dashboard/rfq")
  revalidatePath(`/dashboard/rfq/${rfqId}`)
  return { success: true, id: rfqId }
}
