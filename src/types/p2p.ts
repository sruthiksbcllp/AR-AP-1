import type { VendorStatus } from "@/types/contacts"

export type ItemKind = "goods" | "service"

export type CatalogItem = {
  id: string
  org_id: string
  sku: string
  name: string
  description: string | null
  category: string
  item_kind: ItemKind
  unit: string
  standard_cost: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PrStatus =
  | "draft"
  | "pending_manager"
  | "approved"
  | "rejected"
  | "in_procurement"
  | "ordered"

export type PrLine = {
  id: string
  pr_id: string
  item_id: string | null
  description: string
  quantity: number
  estimated_unit_cost: number
  line_total: number
}

export type PurchaseRequisition = {
  id: string
  org_id: string
  pr_number: string
  department: string
  cost_center: string
  requester_id: string | null
  vendor_id: string | null
  vendor_name: string | null
  vendor_status: VendorStatus | null
  need_by_date: string | null
  business_justification: string
  estimated_cost: number
  status: PrStatus
  created_at: string
  lines: PrLine[]
  requester_email: string | null
}

export type PoStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "released"
  | "closed"
  | "rejected"

export type PoLine = {
  id: string
  po_id: string
  item_id: string | null
  description: string
  quantity: number
  rate: number
  tax_rate: number
  line_total: number
}

export type PurchaseOrder = {
  id: string
  org_id: string
  po_number: string
  vendor_id: string
  vendor_name: string | null
  pr_id: string | null
  rfq_id: string | null
  currency: string
  payment_terms: string | null
  delivery_date: string | null
  tax_amount: number
  total_amount: number
  status: PoStatus
  created_at: string
  lines: PoLine[]
}

export type GrnLine = {
  id: string
  po_line_id: string
  description: string
  ordered_qty: number
  received_qty: number
  rejected_qty: number
}

export type GoodsReceipt = {
  id: string
  org_id: string
  grn_number: string
  po_id: string
  po_number: string | null
  warehouse: string
  receipt_date: string
  notes: string | null
  created_at: string
  lines: GrnLine[]
}

export type SesStatus =
  | "performed"
  | "confirmed"
  | "manager_review"
  | "approved"
  | "rejected"

export type ServiceEntry = {
  id: string
  org_id: string
  ses_number: string
  po_id: string
  po_number: string | null
  description: string
  amount: number
  status: SesStatus
  created_at: string
}

export type MatchStatus = "not_required" | "pending" | "pass" | "exception" | "waived"

export type ThreeWayMatch = {
  id: string
  org_id: string
  bill_id: string
  bill_number: string | null
  po_id: string | null
  po_number: string | null
  status: "pass" | "exception"
  po_qty: number
  grn_qty: number
  invoice_qty: number
  exception_stage: "procurement" | "finance" | "closed" | null
  created_at: string
}

export type PaymentProposalStatus =
  | "proposed"
  | "finance_approved"
  | "paid"
  | "confirmed"
  | "rejected"

export type PaymentProposal = {
  id: string
  org_id: string
  bill_id: string
  bill_number: string | null
  vendor_name: string | null
  amount: number
  status: PaymentProposalStatus
  notes: string | null
  created_at: string
}

export const P2P_STEPS = [
  { href: "/dashboard/contacts", label: "Vendor Onboarding" },
  { href: "/dashboard/p2p/pr", label: "PR" },
  { href: "/dashboard/rfq", label: "RFQ" },
  { href: "/dashboard/p2p/po", label: "PO" },
  { href: "/dashboard/p2p/grn", label: "GRN / SES" },
  { href: "/dashboard/ap", label: "Vendor Invoice" },
  { href: "/dashboard/p2p/match", label: "3-Way Match" },
  { href: "/dashboard/accounting/journals", label: "Accounting Entry" },
  { href: "/dashboard/ap", label: "AP Management" },
  { href: "/dashboard/p2p/payments", label: "Payment" },
] as const

export function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}
