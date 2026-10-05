import { getSessionClient } from "@/lib/auth/org"
import type { UserRole } from "@/lib/auth/roles"
import {
  canApproveBillAmount,
  canReviewApprovals,
  isUserRole,
} from "@/lib/auth/roles"
import type { BillListItem } from "@/types/bills"
import type { Contact } from "@/types/contacts"

export type BillsQueryResult = {
  bills: BillListItem[]
  error: string | null
}

export type VendorsQueryResult = {
  vendors: Pick<Contact, "id" | "name" | "email" | "currency">[]
  error: string | null
}

export type PendingApprovalsQueryResult = {
  bills: BillListItem[]
  role: UserRole | null
  canApprove: boolean
  error: string | null
}

function toNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function mapBillRow(row: Record<string, unknown>): BillListItem {
  const vendorRaw = row.vendor
  const vendor = Array.isArray(vendorRaw)
    ? (vendorRaw[0] ?? null)
    : (vendorRaw ?? null)

  return {
    id: row.id as string,
    org_id: row.org_id as string,
    vendor_id: row.vendor_id as string,
    bill_number: row.bill_number as string,
    total_amount: toNumber(row.total_amount),
    balance_due: toNumber(row.balance_due),
    status: row.status as BillListItem["status"],
    due_date: row.due_date as string,
    attachment_path: (row.attachment_path as string | null) ?? null,
    attachment_name: (row.attachment_name as string | null) ?? null,
    attachment_mime: (row.attachment_mime as string | null) ?? null,
    created_at: row.created_at as string,
    vendor: vendor
      ? {
          id: (vendor as { id: string }).id,
          name: (vendor as { name: string }).name,
          email: ((vendor as { email: string | null }).email as string | null) ?? null,
        }
      : null,
  }
}

const BILL_SELECT = `
  id,
  org_id,
  vendor_id,
  bill_number,
  total_amount,
  balance_due,
  status,
  due_date,
  attachment_path,
  attachment_name,
  attachment_mime,
  created_at,
  vendor:contacts!bills_vendor_id_fkey (
    id,
    name,
    email
  )
`

export async function getBills(): Promise<BillsQueryResult> {
  const session = await getSessionClient()
  if (!session.ok) {
    return { bills: [], error: session.error }
  }

  try {
    const { supabase } = session
    const { data, error } = await supabase
      .from("bills")
      .select(BILL_SELECT)
      .order("created_at", { ascending: false })

    if (error) {
      return { bills: [], error: error.message }
    }

    return {
      bills: (data ?? []).map((row) =>
        mapBillRow(row as Record<string, unknown>)
      ),
      error: null,
    }
  } catch (error) {
    return {
      bills: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to load bills from Supabase.",
    }
  }
}

export async function getVendorOptions(): Promise<VendorsQueryResult> {
  const session = await getSessionClient()
  if (!session.ok) {
    return { vendors: [], error: session.error }
  }

  try {
    const { supabase } = session
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, email, currency")
      .eq("type", "vendor")
      .order("name", { ascending: true })

    if (error) {
      return { vendors: [], error: error.message }
    }

    return {
      vendors: (data ?? []) as VendorsQueryResult["vendors"],
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

export async function getPendingApprovalBills(): Promise<PendingApprovalsQueryResult> {
  const session = await getSessionClient()
  if (!session.ok) {
    return {
      bills: [],
      role: null,
      canApprove: false,
      error: session.error,
    }
  }

  try {
    const { supabase, userId } = session

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle()

    const role = isUserRole(String(profile?.role ?? ""))
      ? (profile?.role as UserRole)
      : null
    const canApprove = role ? canReviewApprovals(role) : false

    if (!role || !canApprove) {
      return {
        bills: [],
        role,
        canApprove: false,
        error: null,
      }
    }

    const { data, error } = await supabase
      .from("bills")
      .select(BILL_SELECT)
      .eq("status", "pending_approval")
      .order("created_at", { ascending: true })

    if (error) {
      return { bills: [], role, canApprove, error: error.message }
    }

    const bills = (data ?? [])
      .map((row) => mapBillRow(row as Record<string, unknown>))
      .filter((bill) => canApproveBillAmount(role, bill.total_amount))

    return {
      bills,
      role,
      canApprove,
      error: null,
    }
  } catch (error) {
    return {
      bills: [],
      role: null,
      canApprove: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load pending approvals.",
    }
  }
}
