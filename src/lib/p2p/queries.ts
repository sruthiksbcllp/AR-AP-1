import { getSessionClient } from "@/lib/auth/org"
import { num } from "@/types/p2p"
import type {
  CatalogItem,
  GoodsReceipt,
  PaymentProposal,
  PurchaseOrder,
  PurchaseRequisition,
  ServiceEntry,
  ThreeWayMatch,
} from "@/types/p2p"

function asItem(row: Record<string, unknown>): CatalogItem {
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    sku: String(row.sku),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    category: String(row.category),
    item_kind: row.item_kind === "service" ? "service" : "goods",
    unit: String(row.unit ?? "each"),
    standard_cost: num(row.standard_cost),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function getCatalogItems(): Promise<{
  items: CatalogItem[]
  error: string | null
}> {
  const session = await getSessionClient()
  if (!session.ok) return { items: [], error: session.error }
  const { data, error } = await session.supabase
    .from("catalog_items")
    .select("*")
    .order("sku", { ascending: true })
  if (error) return { items: [], error: error.message }
  return { items: (data ?? []).map((row) => asItem(row as Record<string, unknown>)), error: null }
}

export async function getCatalogItem(id: string): Promise<{
  item: CatalogItem | null
  error: string | null
}> {
  const session = await getSessionClient()
  if (!session.ok) return { item: null, error: session.error }
  const { data, error } = await session.supabase
    .from("catalog_items")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error) return { item: null, error: error.message }
  if (!data) return { item: null, error: "Item not found." }
  return { item: asItem(data as Record<string, unknown>), error: null }
}

export async function getPurchaseRequisitions(): Promise<{
  rows: PurchaseRequisition[]
  error: string | null
}> {
  const session = await getSessionClient()
  if (!session.ok) return { rows: [], error: session.error }
  const { data, error } = await session.supabase
    .from("purchase_requisitions")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []) as Record<string, unknown>[]
  const ids = rows.map((row) => String(row.id))
  const { data: lines } = ids.length
    ? await session.supabase.from("pr_lines").select("*").in("pr_id", ids)
    : { data: [] }
  const requesterIds = [
    ...new Set(rows.map((row) => row.requester_id).filter(Boolean).map(String)),
  ]
  const emails = new Map<string, string>()
  if (requesterIds.length) {
    const { data: users } = await session.supabase
      .from("users")
      .select("id, email")
      .in("id", requesterIds)
    for (const user of users ?? []) emails.set(String(user.id), String(user.email))
  }
  const linesByPr = new Map<string, PurchaseRequisition["lines"]>()
  for (const line of (lines ?? []) as Record<string, unknown>[]) {
    const prId = String(line.pr_id)
    const next = linesByPr.get(prId) ?? []
    next.push({
      id: String(line.id),
      pr_id: prId,
      item_id: (line.item_id as string | null) ?? null,
      description: String(line.description),
      quantity: num(line.quantity),
      estimated_unit_cost: num(line.estimated_unit_cost),
      line_total: num(line.line_total),
    })
    linesByPr.set(prId, next)
  }
  return {
    rows: rows.map((row) => ({
      id: String(row.id),
      org_id: String(row.org_id),
      pr_number: String(row.pr_number),
      department: String(row.department),
      cost_center: String(row.cost_center),
      requester_id: (row.requester_id as string | null) ?? null,
      need_by_date: (row.need_by_date as string | null) ?? null,
      business_justification: String(row.business_justification),
      estimated_cost: num(row.estimated_cost),
      status: row.status as PurchaseRequisition["status"],
      created_at: String(row.created_at),
      lines: linesByPr.get(String(row.id)) ?? [],
      requester_email: row.requester_id
        ? (emails.get(String(row.requester_id)) ?? null)
        : null,
    })),
    error: null,
  }
}

export async function getPurchaseRequisition(id: string) {
  const { rows, error } = await getPurchaseRequisitions()
  if (error) return { pr: null, error }
  const pr = rows.find((row) => row.id === id) ?? null
  return { pr, error: pr ? null : "Purchase requisition not found." }
}

export async function getPurchaseOrders(): Promise<{
  rows: PurchaseOrder[]
  error: string | null
}> {
  const session = await getSessionClient()
  if (!session.ok) return { rows: [], error: session.error }
  const { data, error } = await session.supabase
    .from("purchase_orders")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []) as Record<string, unknown>[]
  const ids = rows.map((row) => String(row.id))
  const vendorIds = [...new Set(rows.map((row) => String(row.vendor_id)))]
  const names = new Map<string, string>()
  if (vendorIds.length) {
    const { data: vendors } = await session.supabase
      .from("contacts")
      .select("id, name")
      .in("id", vendorIds)
    for (const vendor of vendors ?? []) names.set(String(vendor.id), String(vendor.name))
  }
  const { data: lines } = ids.length
    ? await session.supabase.from("po_lines").select("*").in("po_id", ids)
    : { data: [] }
  const linesByPo = new Map<string, PurchaseOrder["lines"]>()
  for (const line of (lines ?? []) as Record<string, unknown>[]) {
    const poId = String(line.po_id)
    const next = linesByPo.get(poId) ?? []
    next.push({
      id: String(line.id),
      po_id: poId,
      item_id: (line.item_id as string | null) ?? null,
      description: String(line.description),
      quantity: num(line.quantity),
      rate: num(line.rate),
      tax_rate: num(line.tax_rate),
      line_total: num(line.line_total),
    })
    linesByPo.set(poId, next)
  }
  return {
    rows: rows.map((row) => ({
      id: String(row.id),
      org_id: String(row.org_id),
      po_number: String(row.po_number),
      vendor_id: String(row.vendor_id),
      vendor_name: names.get(String(row.vendor_id)) ?? null,
      pr_id: (row.pr_id as string | null) ?? null,
      rfq_id: (row.rfq_id as string | null) ?? null,
      currency: String(row.currency),
      payment_terms: (row.payment_terms as string | null) ?? null,
      delivery_date: (row.delivery_date as string | null) ?? null,
      tax_amount: num(row.tax_amount),
      total_amount: num(row.total_amount),
      status: row.status as PurchaseOrder["status"],
      created_at: String(row.created_at),
      lines: linesByPo.get(String(row.id)) ?? [],
    })),
    error: null,
  }
}

export async function getPurchaseOrder(id: string) {
  const { rows, error } = await getPurchaseOrders()
  if (error) return { po: null, error }
  const po = rows.find((row) => row.id === id) ?? null
  return { po, error: po ? null : "Purchase order not found." }
}

export async function getGoodsReceipts(): Promise<{
  rows: GoodsReceipt[]
  error: string | null
}> {
  const session = await getSessionClient()
  if (!session.ok) return { rows: [], error: session.error }
  const { data, error } = await session.supabase
    .from("goods_receipts")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []) as Record<string, unknown>[]
  const ids = rows.map((row) => String(row.id))
  const poIds = [...new Set(rows.map((row) => String(row.po_id)))]
  const poNumbers = new Map<string, string>()
  if (poIds.length) {
    const { data: pos } = await session.supabase
      .from("purchase_orders")
      .select("id, po_number")
      .in("id", poIds)
    for (const po of pos ?? []) poNumbers.set(String(po.id), String(po.po_number))
  }
  const { data: grnLines } = ids.length
    ? await session.supabase.from("grn_lines").select("*").in("grn_id", ids)
    : { data: [] }
  const poLineIds = [
    ...new Set(
      ((grnLines ?? []) as Record<string, unknown>[]).map((line) => String(line.po_line_id))
    ),
  ]
  const poLines = new Map<string, { description: string; quantity: number }>()
  if (poLineIds.length) {
    const { data: lineRows } = await session.supabase
      .from("po_lines")
      .select("id, description, quantity")
      .in("id", poLineIds)
    for (const line of lineRows ?? []) {
      poLines.set(String(line.id), {
        description: String(line.description),
        quantity: num(line.quantity),
      })
    }
  }
  const linesByGrn = new Map<string, GoodsReceipt["lines"]>()
  for (const line of (grnLines ?? []) as Record<string, unknown>[]) {
    const grnId = String(line.grn_id)
    const poLine = poLines.get(String(line.po_line_id))
    const next = linesByGrn.get(grnId) ?? []
    next.push({
      id: String(line.id),
      po_line_id: String(line.po_line_id),
      description: poLine?.description ?? "Item",
      ordered_qty: poLine?.quantity ?? 0,
      received_qty: num(line.received_qty),
      rejected_qty: num(line.rejected_qty),
    })
    linesByGrn.set(grnId, next)
  }
  return {
    rows: rows.map((row) => ({
      id: String(row.id),
      org_id: String(row.org_id),
      grn_number: String(row.grn_number),
      po_id: String(row.po_id),
      po_number: poNumbers.get(String(row.po_id)) ?? null,
      warehouse: String(row.warehouse),
      receipt_date: String(row.receipt_date),
      notes: (row.notes as string | null) ?? null,
      created_at: String(row.created_at),
      lines: linesByGrn.get(String(row.id)) ?? [],
    })),
    error: null,
  }
}

export async function getGoodsReceipt(id: string) {
  const { rows, error } = await getGoodsReceipts()
  if (error) return { grn: null, error }
  const grn = rows.find((row) => row.id === id) ?? null
  return { grn, error: grn ? null : "Goods receipt not found." }
}

export async function getServiceEntries(): Promise<{
  rows: ServiceEntry[]
  error: string | null
}> {
  const session = await getSessionClient()
  if (!session.ok) return { rows: [], error: session.error }
  const { data, error } = await session.supabase
    .from("service_entries")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []) as Record<string, unknown>[]
  const poIds = [...new Set(rows.map((row) => String(row.po_id)))]
  const poNumbers = new Map<string, string>()
  if (poIds.length) {
    const { data: pos } = await session.supabase
      .from("purchase_orders")
      .select("id, po_number")
      .in("id", poIds)
    for (const po of pos ?? []) poNumbers.set(String(po.id), String(po.po_number))
  }
  return {
    rows: rows.map((row) => ({
      id: String(row.id),
      org_id: String(row.org_id),
      ses_number: String(row.ses_number),
      po_id: String(row.po_id),
      po_number: poNumbers.get(String(row.po_id)) ?? null,
      description: String(row.description),
      amount: num(row.amount),
      status: row.status as ServiceEntry["status"],
      created_at: String(row.created_at),
    })),
    error: null,
  }
}

export async function getMatches(): Promise<{
  rows: ThreeWayMatch[]
  error: string | null
}> {
  const session = await getSessionClient()
  if (!session.ok) return { rows: [], error: session.error }
  const { data, error } = await session.supabase
    .from("three_way_matches")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []) as Record<string, unknown>[]
  const billIds = rows.map((row) => String(row.bill_id))
  const poIds = rows.map((row) => row.po_id).filter(Boolean).map(String)
  const bills = new Map<string, string>()
  const pos = new Map<string, string>()
  if (billIds.length) {
    const { data: billRows } = await session.supabase
      .from("bills")
      .select("id, bill_number")
      .in("id", billIds)
    for (const bill of billRows ?? []) bills.set(String(bill.id), String(bill.bill_number))
  }
  if (poIds.length) {
    const { data: poRows } = await session.supabase
      .from("purchase_orders")
      .select("id, po_number")
      .in("id", poIds)
    for (const po of poRows ?? []) pos.set(String(po.id), String(po.po_number))
  }
  return {
    rows: rows.map((row) => ({
      id: String(row.id),
      org_id: String(row.org_id),
      bill_id: String(row.bill_id),
      bill_number: bills.get(String(row.bill_id)) ?? null,
      po_id: (row.po_id as string | null) ?? null,
      po_number: row.po_id ? (pos.get(String(row.po_id)) ?? null) : null,
      status: row.status as ThreeWayMatch["status"],
      po_qty: num(row.po_qty),
      grn_qty: num(row.grn_qty),
      invoice_qty: num(row.invoice_qty),
      exception_stage: (row.exception_stage as ThreeWayMatch["exception_stage"]) ?? null,
      created_at: String(row.created_at),
    })),
    error: null,
  }
}

export async function getPaymentProposals(): Promise<{
  rows: PaymentProposal[]
  error: string | null
}> {
  const session = await getSessionClient()
  if (!session.ok) return { rows: [], error: session.error }
  const { data, error } = await session.supabase
    .from("payment_proposals")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []) as Record<string, unknown>[]
  const billIds = rows.map((row) => String(row.bill_id))
  const bills = new Map<string, { number: string; vendorId: string }>()
  if (billIds.length) {
    const { data: billRows } = await session.supabase
      .from("bills")
      .select("id, bill_number, vendor_id")
      .in("id", billIds)
    for (const bill of billRows ?? []) {
      bills.set(String(bill.id), {
        number: String(bill.bill_number),
        vendorId: String(bill.vendor_id),
      })
    }
  }
  const vendorIds = [...new Set([...bills.values()].map((bill) => bill.vendorId))]
  const vendors = new Map<string, string>()
  if (vendorIds.length) {
    const { data: vendorRows } = await session.supabase
      .from("contacts")
      .select("id, name")
      .in("id", vendorIds)
    for (const vendor of vendorRows ?? []) vendors.set(String(vendor.id), String(vendor.name))
  }
  return {
    rows: rows.map((row) => {
      const bill = bills.get(String(row.bill_id))
      return {
        id: String(row.id),
        org_id: String(row.org_id),
        bill_id: String(row.bill_id),
        bill_number: bill?.number ?? null,
        vendor_name: bill ? (vendors.get(bill.vendorId) ?? null) : null,
        amount: num(row.amount),
        status: row.status as PaymentProposal["status"],
        notes: (row.notes as string | null) ?? null,
        created_at: String(row.created_at),
      }
    }),
    error: null,
  }
}

export async function getUnmatchedBills(): Promise<{
  rows: { id: string; bill_number: string; po_id: string | null; match_status: string; total_amount: number }[]
  error: string | null
}> {
  const session = await getSessionClient()
  if (!session.ok) return { rows: [], error: session.error }
  const { data, error } = await session.supabase
    .from("bills")
    .select("id, bill_number, po_id, match_status, total_amount")
    .not("po_id", "is", null)
    .in("match_status", ["pending", "exception"])
    .order("created_at", { ascending: false })
  if (error) return { rows: [], error: error.message }
  return {
    rows: (data ?? []).map((row) => ({
      id: String(row.id),
      bill_number: String(row.bill_number),
      po_id: (row.po_id as string | null) ?? null,
      match_status: String(row.match_status),
      total_amount: num(row.total_amount),
    })),
    error: null,
  }
}

export async function getPayableBills(): Promise<{
  rows: { id: string; bill_number: string; vendor_name: string | null; balance_due: number }[]
  error: string | null
}> {
  const session = await getSessionClient()
  if (!session.ok) return { rows: [], error: session.error }
  const { data, error } = await session.supabase
    .from("bills")
    .select("id, bill_number, vendor_id, balance_due, on_hold, match_status, status")
    .gt("balance_due", 0)
    .eq("on_hold", false)
    .in("status", ["approved", "partially_paid"])
    .neq("match_status", "exception")
    .order("due_date", { ascending: true })
  if (error) return { rows: [], error: error.message }
  const vendorIds = [...new Set((data ?? []).map((row) => String(row.vendor_id)))]
  const vendors = new Map<string, string>()
  if (vendorIds.length) {
    const { data: vendorRows } = await session.supabase
      .from("contacts")
      .select("id, name")
      .in("id", vendorIds)
    for (const vendor of vendorRows ?? []) vendors.set(String(vendor.id), String(vendor.name))
  }
  return {
    rows: (data ?? []).map((row) => ({
      id: String(row.id),
      bill_number: String(row.bill_number),
      vendor_name: vendors.get(String(row.vendor_id)) ?? null,
      balance_due: num(row.balance_due),
    })),
    error: null,
  }
}

export async function getP2pCounts() {
  const session = await getSessionClient()
  if (!session.ok) {
    return {
      items: 0,
      prs: 0,
      pos: 0,
      grns: 0,
      ses: 0,
      matches: 0,
      payments: 0,
      error: session.error,
    }
  }
  const [items, prs, pos, grns, ses, matches, payments] = await Promise.all([
    session.supabase.from("catalog_items").select("id", { count: "exact", head: true }),
    session.supabase.from("purchase_requisitions").select("id", { count: "exact", head: true }),
    session.supabase.from("purchase_orders").select("id", { count: "exact", head: true }),
    session.supabase.from("goods_receipts").select("id", { count: "exact", head: true }),
    session.supabase.from("service_entries").select("id", { count: "exact", head: true }),
    session.supabase.from("three_way_matches").select("id", { count: "exact", head: true }),
    session.supabase.from("payment_proposals").select("id", { count: "exact", head: true }),
  ])
  return {
    items: items.count ?? 0,
    prs: prs.count ?? 0,
    pos: pos.count ?? 0,
    grns: grns.count ?? 0,
    ses: ses.count ?? 0,
    matches: matches.count ?? 0,
    payments: payments.count ?? 0,
    error: null as string | null,
  }
}
