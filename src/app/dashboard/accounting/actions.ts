"use server"

import { revalidatePath } from "next/cache"

import { postJournal, revalidateAccounting } from "@/lib/accounting/post"
import { requireOrgContext } from "@/lib/auth/org"
import { canPostJournals, deniedMessage } from "@/lib/auth/roles"
import { roundMoney } from "@/types/invoices"

export type ActionResult =
  | { success: true; id: string }
  | { success: false; error: string }

export async function createManualJournal(input: {
  postingDate: string
  description: string
  lines: { accountId: string; debit: number; credit: number }[]
}): Promise<ActionResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!canPostJournals(auth.ctx.role)) {
    return { success: false, error: deniedMessage("post journals") }
  }

  const postingDate = String(input.postingDate ?? "").trim()
  const description = String(input.description ?? "").trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(postingDate)) {
    return { success: false, error: "Posting date must be a valid date." }
  }
  if (description.length < 3) {
    return { success: false, error: "Description must be at least 3 characters." }
  }

  const lines = (input.lines ?? [])
    .map((line) => ({
      account_id: String(line.accountId ?? "").trim(),
      description,
      debit: roundMoney(Number(line.debit) || 0),
      credit: roundMoney(Number(line.credit) || 0),
    }))
    .filter((line) => line.account_id && (line.debit > 0 || line.credit > 0))

  if (lines.length < 2) {
    return { success: false, error: "Add at least two lines with an amount." }
  }

  const debit = roundMoney(lines.reduce((sum, line) => sum + line.debit, 0))
  const credit = roundMoney(lines.reduce((sum, line) => sum + line.credit, 0))
  if (debit !== credit || debit <= 0) {
    return { success: false, error: "Debits must equal credits before posting." }
  }

  const posted = await postJournal(auth.ctx.supabase, {
    postingDate,
    description,
    source: "manual",
    lines,
  })

  if (!posted.ok) return { success: false, error: posted.error }

  await auth.ctx.supabase.from("audit_logs").insert({
    org_id: auth.ctx.orgId,
    user_id: auth.ctx.userId,
    action: "journal.post",
    entity: "journals",
    entity_id: posted.id,
    changes_json: {
      after: { description, postingDate, debit, credit, source: "manual" },
    },
  })

  revalidateAccounting()
  revalidatePath("/dashboard/audit")
  return { success: true, id: posted.id }
}
