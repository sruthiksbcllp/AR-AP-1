import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { CompanyPicker } from "@/app/select-company/company-picker"
import { signOut } from "@/app/login/actions"
import { AppLogo } from "@/components/brand/app-logo"
import { Button } from "@/components/ui/button"
import { APP_NAME } from "@/lib/brand"
import { getCompanyMemberships, getSessionClient } from "@/lib/auth/org"
import { ROLE_LABELS, isUserRole } from "@/lib/auth/roles"

export const metadata: Metadata = { title: "Select your company" }

export default async function SelectCompanyPage() {
  const session = await getSessionClient()
  if (!session.ok) redirect("/login")

  const { data: profile } = await session.supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .maybeSingle()

  const companies = await getCompanyMemberships(session.supabase, session.userId)
  const profileRole = String(profile?.role ?? "")
  const intendedRole = isUserRole(profileRole) ? ROLE_LABELS[profileRole] : "Requester"
  const canCreate =
    companies.length === 0 || companies.some((company) => company.role === "admin")

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xs">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AppLogo size={40} className="size-10 shrink-0" priority />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Select your company</h1>
              <p className="text-sm text-muted-foreground">{APP_NAME}</p>
            </div>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
        <CompanyPicker
          companies={companies}
          canCreate={canCreate}
          intendedRole={intendedRole}
        />
      </div>
    </main>
  )
}
