"use server"

import { revalidatePath } from "next/cache"

import { requireOrgContext } from "@/lib/auth/org"
import { canManageCompanies, isUserRole } from "@/lib/auth/roles"

export type AdminResult =
  | { success: true }
  | { success: false; error: string }

export async function addCompanyMember(formData: FormData): Promise<AdminResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!canManageCompanies(auth.ctx.role)) {
    return { success: false, error: "Only a company admin can tag members." }
  }

  const orgId = String(formData.get("org_id") ?? "").trim() || auth.ctx.orgId
  const email = String(formData.get("email") ?? "").trim()
  const roleValue = String(formData.get("role") ?? "")
  const role = isUserRole(roleValue) ? roleValue : null
  if (!email || !role) {
    return { success: false, error: "Email and role are required." }
  }

  const { error } = await auth.ctx.supabase.rpc("add_company_member", {
    p_org_id: orgId,
    p_email: email,
    p_role: role,
  })
  if (error) return { success: false, error: error.message }

  revalidatePath("/dashboard/admin")
  revalidatePath(`/dashboard/admin/${orgId}`)
  return { success: true }
}

export async function removeCompanyMember(formData: FormData): Promise<AdminResult> {
  const auth = await requireOrgContext()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!canManageCompanies(auth.ctx.role)) {
    return { success: false, error: "Only a company admin can remove members." }
  }

  const orgId = String(formData.get("org_id") ?? "").trim() || auth.ctx.orgId
  const userId = String(formData.get("user_id") ?? "").trim()
  if (!userId) return { success: false, error: "Select a member." }

  const { error } = await auth.ctx.supabase.rpc("remove_company_member", {
    p_org_id: orgId,
    p_user_id: userId,
  })
  if (error) return { success: false, error: error.message }

  revalidatePath("/dashboard/admin")
  revalidatePath(`/dashboard/admin/${orgId}`)
  return { success: true }
}
