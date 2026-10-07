import type { Metadata } from "next"
import Link from "next/link"

import { CreateCompanyForm } from "@/app/select-company/company-picker"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import { ROLE_LABELS, canManageCompanies, roleLabel } from "@/lib/auth/roles"

export const metadata: Metadata = { title: "Admin Portal" }

export default async function AdminPortalPage() {
  const auth = await requireOrgContext()
  if (!auth.ok) {
    return (
      <PageShell title="Admin Portal" description={auth.error}>
        <p className="text-sm text-muted-foreground">Sign in as a company admin.</p>
      </PageShell>
    )
  }

  const adminCompanies = auth.ctx.companies.filter((company) => company.role === "admin")
  const { data: members } = await auth.ctx.supabase
    .from("organization_memberships")
    .select("user_id, role, org_id")
    .eq("org_id", auth.ctx.orgId)

  const userIds = [...new Set((members ?? []).map((row) => String(row.user_id)))]
  const emails = new Map<string, string>()
  if (userIds.length) {
    const { data: users } = await auth.ctx.supabase
      .from("users")
      .select("id, email")
      .in("id", userIds)
    for (const user of users ?? []) emails.set(String(user.id), String(user.email))
  }

  return (
    <PageShell
      title="Admin Portal"
      description="Companies and role tags. All tagged users share this company's data; each role only sees the modules that apply to them."
    >
      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Active company</h2>
        <p className="mt-1 text-lg font-medium">{auth.ctx.orgName}</p>
        <p className="text-sm text-muted-foreground">
          {members?.length ?? 0} tagged user{(members?.length ?? 0) === 1 ? "" : "s"} · your role{" "}
          {ROLE_LABELS[auth.ctx.role]}
        </p>
      </section>

      <section className="rounded-xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Members of {auth.ctx.orgName}</h2>
          {canManageCompanies(auth.ctx.role) ? (
            <Link href={`/dashboard/admin/${auth.ctx.orgId}`} className="text-sm underline">
              Manage members
            </Link>
          ) : null}
        </div>
        <ul className="divide-y text-sm">
          {(members ?? []).map((row) => (
            <li key={`${row.org_id}-${row.user_id}`} className="flex justify-between gap-3 py-2">
              <span>{emails.get(String(row.user_id)) ?? row.user_id}</span>
              <span className="text-muted-foreground">{roleLabel(String(row.role))}</span>
            </li>
          ))}
        </ul>
      </section>

      {canManageCompanies(auth.ctx.role) ? <CreateCompanyForm /> : null}
      {adminCompanies.length > 0 ? (
        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Companies you administer</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {adminCompanies.map((company) => (
              <li key={company.id}>
                <Link href={`/dashboard/admin/${company.id}`} className="hover:underline">
                  {company.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageShell>
  )
}
