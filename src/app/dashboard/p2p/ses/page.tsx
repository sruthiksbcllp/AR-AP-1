import type { Metadata } from "next"
import Link from "next/link"

import { SesAdvanceButton } from "@/components/p2p/p2p-actions"
import { Button } from "@/components/ui/button"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import { canCreateSes, canReviewSes } from "@/lib/auth/roles"
import { getServiceEntries } from "@/lib/p2p/queries"
import { formatINR } from "@/lib/currency"

export const metadata: Metadata = { title: "Service Entry Sheet" }

export default async function SesListPage() {
  const [{ rows, error }, auth] = await Promise.all([
    getServiceEntries(),
    requireOrgContext(),
  ])
  const role = auth.ok ? auth.ctx.role : null

  return (
    <PageShell
      title="Service Entry Sheet (SES)"
      description="Used for service procurements such as audit fees, consultancy, legal services, and IT support."
    >
      <P2pNav />
      <div className="flex justify-end">
        {role && canCreateSes(role) ? (
          <Button asChild>
            <Link href="/dashboard/p2p/ses/new">New SES</Link>
          </Button>
        ) : null}
      </div>
      {error ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">{error}</p> : null}
      <ol className="grid gap-2 sm:grid-cols-4">
        {["Service performed", "Service confirmation", "Manager review", "SES approval"].map((label, index) => (
          <li key={label} className="rounded-lg border bg-muted/20 px-3 py-3">
            <p className="text-xs text-muted-foreground">{index + 1}</p>
            <p className="text-sm font-medium">{label}</p>
          </li>
        ))}
      </ol>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">SES</th>
              <th className="px-3 py-2 font-medium">PO</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No service entries yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{row.ses_number}</td>
                  <td className="px-3 py-2">{row.po_number ?? "—"}</td>
                  <td className="px-3 py-2">{row.description}</td>
                  <td className="px-3 py-2 capitalize">{row.status.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(row.amount)}</td>
                  <td className="px-3 py-2">
                    {role && canReviewSes(role, row.status) ? (
                      <SesAdvanceButton id={row.id} status={row.status} />
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  )
}
