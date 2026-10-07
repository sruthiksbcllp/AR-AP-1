"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { setSelectedCompanyCookie } from "@/lib/auth/company"
import { getSessionClient } from "@/lib/auth/org"
import { homePathForRole, isUserRole } from "@/lib/auth/roles"

export type CompanyActionState =
  | { success: true }
  | { success: false; error: string }

export async function selectCompany(formData: FormData): Promise<void> {
  const orgId = String(formData.get("org_id") ?? "").trim()
  const session = await getSessionClient()
  if (!session.ok) redirect("/login")
  if (!orgId) redirect("/select-company")

  const { data: membership } = await session.supabase
    .from("organization_memberships")
    .select("org_id, role")
    .eq("user_id", session.userId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (!membership) {
    redirect("/select-company")
  }

  const role = isUserRole(String(membership.role)) ? membership.role : "requester"
  const { error } = await session.supabase
    .from("users")
    .update({ org_id: orgId, role })
    .eq("id", session.userId)

  if (error) {
    redirect("/select-company")
  }

  await setSelectedCompanyCookie(orgId)
  revalidatePath("/", "layout")
  redirect(homePathForRole(role))
}

export async function createCompany(
  _prev: CompanyActionState | null,
  formData: FormData
): Promise<CompanyActionState> {
  const name = String(formData.get("name") ?? "").trim()
  if (name.length < 2) {
    return { success: false, error: "Enter a company name." }
  }

  const session = await getSessionClient()
  if (!session.ok) return { success: false, error: session.error }

  const { data, error } = await session.supabase.rpc("create_company", {
    p_name: name,
  })

  if (error || !data) {
    return { success: false, error: error?.message ?? "Could not create the company." }
  }

  const orgId = String(data)
  const { error: switchError } = await session.supabase
    .from("users")
    .update({ org_id: orgId, role: "admin" })
    .eq("id", session.userId)

  if (switchError) {
    return { success: false, error: switchError.message }
  }

  await setSelectedCompanyCookie(orgId)
  revalidatePath("/", "layout")
  redirect("/dashboard/admin")
}
