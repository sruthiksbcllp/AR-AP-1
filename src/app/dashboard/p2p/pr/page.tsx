import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import { canCreatePr } from "@/lib/auth/roles"
import { getPurchaseRequisitions } from "@/lib/p2p/queries"
import { formatINR } from "@/lib/currency"

export const metadata: Metadata = { title: "Purchase Requisition" }

export default async function PrListPage() {
  const [{ rows, error }, auth] = await Promise.all([
    getPurchaseRequisitions(),
    requireOrgContext(),
  ])
  const canCreate = auth.ok && canCreatePr(auth.ctx.role)

  return (
    <PageShell
      title="Purchase Requisition (PR)"
      description="An internal request raised by an employee or department for goods or services."
    >
      <P2pNav />
      <div className="flex justify-end">
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/p2p/pr/new">New PR</Link>
          </Button>
        ) : null}
      </div>
      {error ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">PR number</th>
              <th className="px-3 py-2 font-medium">Department</th>
              <th className="px-3 py-2 font-medium">Cost center</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Estimated cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No purchase requisitions yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/p2p/pr/${row.id}`} className="font-medium hover:underline">
                      {row.pr_number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.department}</td>
                  <td className="px-3 py-2">{row.cost_center}</td>
                  <td className="px-3 py-2 capitalize">{row.status.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(row.estimated_cost)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  )
}
