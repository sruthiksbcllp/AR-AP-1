export type ContactType = "customer" | "vendor"

export const VENDOR_STATUSES = [
  "procurement_review",
  "finance_review",
  "compliance_check",
  "active",
  "rejected",
] as const

export type VendorStatus = (typeof VENDOR_STATUSES)[number]

export const VENDOR_WORKFLOW_STEPS = [
  { step: 1, key: "business_user", label: "Business User" },
  { step: 2, key: "procurement_review", label: "Procurement Review" },
  { step: 3, key: "finance_review", label: "Finance Review" },
  { step: 4, key: "compliance_check", label: "Compliance Check" },
  { step: 5, key: "active", label: "Vendor Created" },
] as const

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  procurement_review: "Procurement review",
  finance_review: "Finance review",
  compliance_check: "Compliance check",
  active: "Vendor created",
  rejected: "Rejected",
}

export const COUNTRY_OPTIONS = [
  "India",
  "United Arab Emirates",
  "United States",
  "United Kingdom",
  "Singapore",
] as const

export const PAYMENT_TERM_OPTIONS = [
  "Immediate",
  "Net 15",
  "Net 30",
  "Net 45",
  "Net 60",
] as const

export type Contact = {
  id: string
  org_id: string
  type: ContactType
  name: string
  email: string | null
  phone: string | null
  tax_id: string | null
  currency: string
  trade_name: string | null
  address: string | null
  country: string | null
  business_registration_number: string | null
  pan: string | null
  gstin: string | null
  tax_residency_certificate: string | null
  contact_person: string | null
  bank_name: string | null
  beneficiary_name: string | null
  account_number: string | null
  ifsc_swift: string | null
  payment_terms: string | null
  credit_period_days: number | null
  vendor_code: string | null
  vendor_status: VendorStatus | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type VendorMaster = Contact & {
  created_by_email: string | null
}

export type CreateContactInput = {
  name: string
  type: ContactType
  email: string
  phone: string
  tax_id: string
  currency: string
}

export type VendorOnboardingInput = {
  name: string
  trade_name: string
  address: string
  country: string
  business_registration_number: string
  pan: string
  gstin: string
  tax_residency_certificate: string
  contact_person: string
  phone: string
  email: string
  bank_name: string
  beneficiary_name: string
  account_number: string
  ifsc_swift: string
  payment_terms: string
  currency: string
  credit_period_days: number
}

export function isVendorStatus(value: string): value is VendorStatus {
  return (VENDOR_STATUSES as readonly string[]).includes(value)
}

export function vendorWorkflowCurrentStep(status: VendorStatus | null) {
  if (!status || status === "rejected") return 0
  if (status === "procurement_review") return 2
  if (status === "finance_review") return 3
  if (status === "compliance_check") return 4
  return 5
}

export function nextVendorStatus(status: VendorStatus): VendorStatus | null {
  if (status === "procurement_review") return "finance_review"
  if (status === "finance_review") return "compliance_check"
  if (status === "compliance_check") return "active"
  return null
}
