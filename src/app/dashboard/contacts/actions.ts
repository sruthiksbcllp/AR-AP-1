"use server"

import { revalidatePath } from "next/cache"

import { requireOrgContext } from "@/lib/auth/org"
import {
  canCreateCustomer,
  canResubmitVendor,
  canReviewVendorStatus,
  canSubmitVendorOnboarding,
  deniedMessage,
} from "@/lib/auth/roles"
import {
  nextVendorStatus,
  type ContactType,
  type CreateContactInput,
  type VendorOnboardingInput,
  type VendorStatus,
} from "@/types/contacts"

export type CreateContactResult =
  | {
      success: true
      id: string
      name: string
      email: string
      currency: string
      type: ContactType
    }
  | { success: false; error: string }

export type VendorActionResult =
  | { success: true; id: string }
  | { success: false; error: string }

function normalizeCurrency(value: string) {
  return value.trim().toUpperCase()
}

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim()
}

function parseCreateContactInput(
  formData: FormData
): CreateContactInput | { error: string } {
  const name = field(formData, "name")
  const type = field(formData, "type") as ContactType
  const email = field(formData, "email")
  const phone = field(formData, "phone")
  const tax_id = field(formData, "tax_id")
  const currency = normalizeCurrency(field(formData, "currency") || "INR")

  if (!name) {
    return { error: "Contact name is required." }
  }

  if (type === "vendor") {
    return {
      error:
        "Vendors must be submitted through Vendor Onboarding before they can be used.",
    }
  }

  if (type !== "customer") {
    return { error: "Type must be Customer." }
  }

  if (!email || !email.includes("@")) {
    return { error: "A valid primary email is required." }
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    return { error: "Preferred currency must be a 3-letter ISO code." }
  }

  return {
    name,
    type,
    email,
    phone,
    tax_id,
    currency,
  }
}

function parseVendorOnboardingInput(
  formData: FormData
): VendorOnboardingInput | { error: string } {
  const currency = normalizeCurrency(field(formData, "currency") || "INR")
  const creditRaw = field(formData, "credit_period_days")
  const credit_period_days = Number(creditRaw)

  const parsed: VendorOnboardingInput = {
    name: field(formData, "name"),
    trade_name: field(formData, "trade_name"),
    address: field(formData, "address"),
    country: field(formData, "country"),
    business_registration_number: field(
      formData,
      "business_registration_number"
    ),
    pan: field(formData, "pan").toUpperCase(),
    gstin: field(formData, "gstin").toUpperCase(),
    tax_residency_certificate: field(formData, "tax_residency_certificate"),
    contact_person: field(formData, "contact_person"),
    phone: field(formData, "phone"),
    email: field(formData, "email"),
    bank_name: field(formData, "bank_name"),
    beneficiary_name: field(formData, "beneficiary_name"),
    account_number: field(formData, "account_number"),
    ifsc_swift: field(formData, "ifsc_swift").toUpperCase(),
    payment_terms: field(formData, "payment_terms"),
    currency,
    credit_period_days,
  }

  const required: [keyof VendorOnboardingInput, string][] = [
    ["name", "Vendor legal name"],
    ["address", "Address"],
    ["country", "Country"],
    ["business_registration_number", "Business registration number"],
    ["pan", "PAN"],
    ["gstin", "GSTIN"],
    ["contact_person", "Contact person"],
    ["phone", "Phone number"],
    ["email", "Email"],
    ["bank_name", "Bank name"],
    ["beneficiary_name", "Beneficiary name"],
    ["account_number", "Account number"],
    ["ifsc_swift", "IFSC / SWIFT"],
    ["payment_terms", "Payment terms"],
  ]

  for (const [key, label] of required) {
    if (!parsed[key]) return { error: `${label} is required.` }
  }

  if (!parsed.email.includes("@")) {
    return { error: "A valid email is required." }
  }

  if (!/^[A-Z]{3}$/.test(parsed.currency)) {
    return { error: "Currency must be a 3-letter ISO code." }
  }

  if (!Number.isInteger(parsed.credit_period_days) || parsed.credit_period_days < 0) {
    return { error: "Credit period must be zero or a positive number of days." }
  }

  if (!parsed.trade_name) {
    parsed.trade_name = parsed.name
  }

  return parsed
}

function revalidateVendorPaths(id?: string) {
  revalidatePath("/dashboard/contacts")
  revalidatePath("/contacts")
  revalidatePath("/dashboard/ap")
  revalidatePath("/dashboard/ap/new")
  revalidatePath("/dashboard/rfq")
  if (id) revalidatePath(`/dashboard/contacts/vendors/${id}`)
}

export async function createContact(
  formData: FormData
): Promise<CreateContactResult> {
  const parsed = parseCreateContactInput(formData)
  if ("error" in parsed) {
    return { success: false, error: parsed.error }
  }

  const auth = await requireOrgContext()
  if (!auth.ok) {
    return { success: false, error: auth.error }
  }

  const { supabase, userId, orgId, role } = auth.ctx

  if (!canCreateCustomer(role)) {
    return { success: false, error: deniedMessage("add customers") }
  }

  const payload = {
    org_id: orgId,
    name: parsed.name,
    type: parsed.type,
    email: parsed.email,
    phone: parsed.phone || null,
    tax_id: parsed.tax_id || null,
    currency: parsed.currency,
  }

  const { data: contact, error: insertError } = await supabase
    .from("contacts")
    .insert(payload)
    .select("id")
    .single()

  if (insertError || !contact) {
    return {
      success: false,
      error: insertError?.message ?? "Failed to create contact.",
    }
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    org_id: orgId,
    user_id: userId,
    action: "contact.create",
    entity: "contacts",
    entity_id: contact.id,
    changes_json: {
      after: payload,
    },
  })

  if (auditError) {
    return {
      success: false,
      error: `Contact created, but audit log failed: ${auditError.message}`,
    }
  }

  revalidateVendorPaths()
  revalidatePath("/dashboard/ar")
  revalidatePath("/dashboard/ar/new")

  return {
    success: true,
    id: contact.id,
    name: parsed.name,
    email: parsed.email,
    currency: parsed.currency,
    type: parsed.type,
  }
}

export async function submitVendorOnboarding(
  formData: FormData
): Promise<VendorActionResult> {
  const parsed = parseVendorOnboardingInput(formData)
  if ("error" in parsed) {
    return { success: false, error: parsed.error }
  }

  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }

  const { supabase, userId, orgId, role } = auth.ctx
  if (!canSubmitVendorOnboarding(role)) {
    return { success: false, error: deniedMessage("submit a vendor for onboarding") }
  }

  const payload = {
    org_id: orgId,
    type: "vendor" as const,
    name: parsed.name,
    trade_name: parsed.trade_name,
    address: parsed.address,
    country: parsed.country,
    business_registration_number: parsed.business_registration_number,
    pan: parsed.pan,
    gstin: parsed.gstin,
    tax_id: parsed.gstin,
    tax_residency_certificate: parsed.tax_residency_certificate || null,
    contact_person: parsed.contact_person,
    phone: parsed.phone,
    email: parsed.email,
    bank_name: parsed.bank_name,
    beneficiary_name: parsed.beneficiary_name,
    account_number: parsed.account_number,
    ifsc_swift: parsed.ifsc_swift,
    payment_terms: parsed.payment_terms,
    currency: parsed.currency,
    credit_period_days: parsed.credit_period_days,
    vendor_status: "procurement_review" as const,
    created_by: userId,
  }

  const { data: vendor, error: insertError } = await supabase
    .from("contacts")
    .insert(payload)
    .select("id, vendor_code")
    .single()

  if (insertError || !vendor) {
    return {
      success: false,
      error: insertError?.message ?? "Failed to submit vendor onboarding.",
    }
  }

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    user_id: userId,
    action: "vendor.onboard",
    entity: "contacts",
    entity_id: vendor.id,
    changes_json: {
      after: {
        name: parsed.name,
        gstin: parsed.gstin,
        vendor_status: "procurement_review",
        vendor_code: vendor.vendor_code,
      },
    },
  })

  revalidateVendorPaths(vendor.id)
  return { success: true, id: vendor.id }
}

export async function reviewVendorOnboarding(input: {
  vendor_id: string
  decision: "approved" | "rejected"
  comments?: string
}): Promise<VendorActionResult> {
  const vendorId = input.vendor_id.trim()
  const comments = (input.comments ?? "").trim()
  if (!vendorId) return { success: false, error: "Vendor is required." }
  if (input.decision === "rejected" && comments.length < 3) {
    return { success: false, error: "Add a comment explaining the rejection." }
  }

  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }

  const { supabase, userId, orgId, role } = auth.ctx
  const { data: vendor, error } = await supabase
    .from("contacts")
    .select("id, vendor_status, name")
    .eq("id", vendorId)
    .eq("type", "vendor")
    .maybeSingle()

  if (error || !vendor) {
    return { success: false, error: error?.message ?? "Vendor not found." }
  }

  const status = vendor.vendor_status as VendorStatus | null
  if (!canReviewVendorStatus(role, status)) {
    return { success: false, error: deniedMessage("review this vendor") }
  }

  const nextStatus: VendorStatus | null =
    input.decision === "rejected" ? "rejected" : nextVendorStatus(status ?? "rejected")

  if (!nextStatus) {
    return { success: false, error: "This vendor is not waiting for review." }
  }

  const { error: updateError } = await supabase
    .from("contacts")
    .update({ vendor_status: nextStatus })
    .eq("id", vendorId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    user_id: userId,
    action:
      input.decision === "rejected" ? "vendor.reject" : "vendor.review",
    entity: "contacts",
    entity_id: vendorId,
    changes_json: {
      after: {
        vendor_status: nextStatus,
        comments: comments || null,
        from: status,
      },
    },
  })

  revalidateVendorPaths(vendorId)
  return { success: true, id: vendorId }
}

export async function resubmitVendorOnboarding(
  vendorId: string
): Promise<VendorActionResult> {
  const id = vendorId.trim()
  if (!id) return { success: false, error: "Vendor is required." }

  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }

  const { supabase, userId, orgId, role } = auth.ctx
  if (!canResubmitVendor(role)) {
    return { success: false, error: deniedMessage("resubmit this vendor") }
  }

  const { data: vendor, error } = await supabase
    .from("contacts")
    .select("id, vendor_status")
    .eq("id", id)
    .eq("type", "vendor")
    .maybeSingle()

  if (error || !vendor) {
    return { success: false, error: error?.message ?? "Vendor not found." }
  }
  if (vendor.vendor_status !== "rejected") {
    return { success: false, error: "Only rejected vendors can be resubmitted." }
  }

  const { error: updateError } = await supabase
    .from("contacts")
    .update({ vendor_status: "procurement_review" })
    .eq("id", id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    user_id: userId,
    action: "vendor.resubmit",
    entity: "contacts",
    entity_id: id,
    changes_json: { after: { vendor_status: "procurement_review" } },
  })

  revalidateVendorPaths(id)
  return { success: true, id }
}
