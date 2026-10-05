"use server"

import { revalidatePath } from "next/cache"

import { requireOrgContext } from "@/lib/auth/org"
import {
  canCreateCustomer,
  canCreateVendor,
  deniedMessage,
} from "@/lib/auth/roles"
import type { ContactType, CreateContactInput } from "@/types/contacts"

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

function normalizeCurrency(value: string) {
  return value.trim().toUpperCase()
}

function parseCreateContactInput(
  formData: FormData
): CreateContactInput | { error: string } {
  const name = String(formData.get("name") ?? "").trim()
  const type = String(formData.get("type") ?? "").trim() as ContactType
  const email = String(formData.get("email") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()
  const tax_id = String(formData.get("tax_id") ?? "").trim()
  const currency = normalizeCurrency(String(formData.get("currency") ?? "INR"))

  if (!name) {
    return { error: "Contact name is required." }
  }

  if (type !== "customer" && type !== "vendor") {
    return { error: "Type must be Customer or Vendor." }
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

  if (parsed.type === "vendor" && !canCreateVendor(role)) {
    return { success: false, error: deniedMessage("add vendors") }
  }
  if (parsed.type === "customer" && !canCreateCustomer(role)) {
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

  revalidatePath("/dashboard/contacts")
  revalidatePath("/contacts")
  revalidatePath("/dashboard/ap")
  revalidatePath("/dashboard/ap/new")
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
