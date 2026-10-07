import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { AddMemberForm, RemoveMemberButton } from "@/components/admin/member-forms"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import { canManageCompanies, roleLabel } from "@/lib/auth/roles"

export const metadata: Metadata = { title: "Company members" }

export default async function AdminCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const auth = await requireOrgContext()
  if (!auth.ok) {
    return (
      <PageShell title="Company members" description={auth.error}>
        <Link href="/dashboard/admin">Back</Link>
      </PageShell>
    )
  }

  const isAdmin = auth.ctx.companies.some(
    (company) => company.id === id && company.role === "admin"
  )
  if (!isAdmin || !canManageCompanies(auth.ctx.role)) {
    notFound()
  }

  const { data: org } = await auth.ctx.supabase
    .from("organizations")
    .select("id, name")
    .eq("id", id)
    .maybeSingle()
  if (!org) notFound()

  const { data: members } = await auth.ctx.supabase
    .from("organization_memberships")
    .select("user_id, role")
    .eq("org_id", id)

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
      title={org.name}
      description="Tag users to this company. They will all work from the same company records, with screens filtered by the role you assign."
    >
      <Link href="/dashboard/admin" className="text-sm underline">
        Back to Admin Portal
      </Link>
      <AddMemberForm orgId={id} />
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((row) => (
              <tr key={row.user_id} className="border-t">
                <td className="px-3 py-2">{emails.get(String(row.user_id)) ?? row.user_id}</td>
                <td className="px-3 py-2">{roleLabel(String(row.role))}</td>
                <td className="px-3 py-2 text-right">
                  <RemoveMemberButton orgId={id} userId={String(row.user_id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  )
}
