import { getSessionClient } from "@/lib/auth/org"
import { createClient } from "@/lib/supabase/server"
import type { Contact, ContactType, VendorMaster } from "@/types/contacts"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export const CONTACT_SELECT = `
  id,
  org_id,
  type,
  name,
  email,
  phone,
  tax_id,
  currency,
  trade_name,
  address,
  country,
  business_registration_number,
  pan,
  gstin,
  tax_residency_certificate,
  contact_person,
  bank_name,
  beneficiary_name,
  account_number,
  ifsc_swift,
  payment_terms,
  credit_period_days,
  vendor_code,
  vendor_status,
  created_by,
  created_at,
  updated_at
`

export type ContactsQueryResult = {
  contacts: Contact[]
  error: string | null
}

export type VendorsQueryResult = {
  vendors: VendorMaster[]
  error: string | null
}

export type VendorQueryResult = {
  vendor: VendorMaster | null
  error: string | null
}

function toContact(row: Record<string, unknown>): Contact {
  const credit = row.credit_period_days
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    type: row.type as ContactType,
    name: String(row.name),
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    tax_id: (row.tax_id as string | null) ?? null,
    currency: String(row.currency ?? "INR"),
    trade_name: (row.trade_name as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    business_registration_number:
      (row.business_registration_number as string | null) ?? null,
    pan: (row.pan as string | null) ?? null,
    gstin: (row.gstin as string | null) ?? null,
    tax_residency_certificate:
      (row.tax_residency_certificate as string | null) ?? null,
    contact_person: (row.contact_person as string | null) ?? null,
    bank_name: (row.bank_name as string | null) ?? null,
    beneficiary_name: (row.beneficiary_name as string | null) ?? null,
    account_number: (row.account_number as string | null) ?? null,
    ifsc_swift: (row.ifsc_swift as string | null) ?? null,
    payment_terms: (row.payment_terms as string | null) ?? null,
    credit_period_days:
      typeof credit === "number"
        ? credit
        : credit == null
          ? null
          : Number.isFinite(Number(credit))
            ? Number(credit)
            : null,
    vendor_code: (row.vendor_code as string | null) ?? null,
    vendor_status: (row.vendor_status as Contact["vendor_status"]) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

async function withCreatorEmails(
  supabase: SupabaseClient,
  contacts: Contact[]
): Promise<VendorMaster[]> {
  const ids = [
    ...new Set(
      contacts
        .map((contact) => contact.created_by)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const emails = new Map<string, string>()
  if (ids.length) {
    const { data } = await supabase.from("users").select("id, email").in("id", ids)
    for (const row of data ?? []) {
      emails.set(row.id as string, String(row.email ?? ""))
    }
  }
  return contacts.map((contact) => ({
    ...contact,
    created_by_email: contact.created_by
      ? (emails.get(contact.created_by) ?? null)
      : null,
  }))
}

export async function getContacts(
  type?: ContactType
): Promise<ContactsQueryResult> {
  const session = await getSessionClient()
  if (!session.ok) {
    return { contacts: [], error: session.error }
  }

  try {
    const { supabase } = session
    let query = supabase
      .from("contacts")
      .select(CONTACT_SELECT)
      .order("name", { ascending: true })
    if (type) query = query.eq("type", type)

    const { data, error } = await query

    if (error) {
      return { contacts: [], error: error.message }
    }

    return {
      contacts: (data ?? []).map((row) =>
        toContact(row as Record<string, unknown>)
      ),
      error: null,
    }
  } catch (error) {
    return {
      contacts: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to load contacts from Supabase.",
    }
  }
}

export async function getVendors(): Promise<VendorsQueryResult> {
  const session = await getSessionClient()
  if (!session.ok) {
    return { vendors: [], error: session.error }
  }

  try {
    const { supabase } = session
    const { data, error } = await supabase
      .from("contacts")
      .select(CONTACT_SELECT)
      .eq("type", "vendor")
      .order("created_at", { ascending: false })

    if (error) {
      return { vendors: [], error: error.message }
    }

    const contacts = (data ?? []).map((row) =>
      toContact(row as Record<string, unknown>)
    )
    return {
      vendors: await withCreatorEmails(supabase, contacts),
      error: null,
    }
  } catch (error) {
    return {
      vendors: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to load vendors from Supabase.",
    }
  }
}

export async function getVendor(id: string): Promise<VendorQueryResult> {
  const session = await getSessionClient()
  if (!session.ok) {
    return { vendor: null, error: session.error }
  }

  try {
    const { supabase } = session
    const { data, error } = await supabase
      .from("contacts")
      .select(CONTACT_SELECT)
      .eq("id", id)
      .eq("type", "vendor")
      .maybeSingle()

    if (error) {
      return { vendor: null, error: error.message }
    }
    if (!data) {
      return { vendor: null, error: "This vendor was not found." }
    }

    const [vendor] = await withCreatorEmails(supabase, [
      toContact(data as Record<string, unknown>),
    ])
    return { vendor, error: null }
  } catch (error) {
    return {
      vendor: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load this vendor from Supabase.",
    }
  }
}
