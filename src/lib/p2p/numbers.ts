import type { OrgContext } from "@/lib/auth/org"

type NumberedTable =
  | "purchase_requisitions"
  | "purchase_orders"
  | "goods_receipts"
  | "service_entries"

export async function nextDocNumber(
  supabase: OrgContext["supabase"],
  table: NumberedTable,
  column: string,
  prefix: string,
  orgId: string
) {
  const { data } = await supabase.from(table).select(column).eq("org_id", orgId)
  let max = 0
  for (const row of data ?? []) {
    const raw = String((row as unknown as Record<string, unknown>)[column] ?? "")
    const n = Number.parseInt(raw.replace(/\D/g, ""), 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`
}
