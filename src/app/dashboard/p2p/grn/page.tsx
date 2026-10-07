import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import { canCreateGrn } from "@/lib/auth/roles"
import { getGoodsReceipts } from "@/lib/p2p/queries"

export const metadata: Metadata = { title: "Goods Receipt Note" }

export default async function GrnListPage() {
  const [{ rows, error }, auth] = await Promise.all([
    getGoodsReceipts(),
    requireOrgContext(),
  ])
  const canCreate = auth.ok && canCreateGrn(auth.ctx.role)

  return (
    <PageShell
      title="Goods Receipt Note (GRN)"
      description="Confirms physical receipt of goods. The supplier cannot usually be paid until goods are received."
    >
      <P2pNav />
      <div className="flex justify-end">
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/p2p/grn/new">New GRN</Link>
          </Button>
        ) : null}
      </div>
      {error ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">GRN number</th>
              <th className="px-3 py-2 font-medium">PO</th>
              <th className="px-3 py-2 font-medium">Warehouse</th>
              <th className="px-3 py-2 font-medium">Receipt date</th>
              <th className="px-3 py-2 text-right font-medium">Received</th>
              <th className="px-3 py-2 text-right font-medium">Rejected</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No goods receipts yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const received = row.lines.reduce((sum, line) => sum + line.received_qty, 0)
                const rejected = row.lines.reduce((sum, line) => sum + line.rejected_qty, 0)
                return (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/p2p/grn/${row.id}`} className="font-medium hover:underline">
                        {row.grn_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.po_number ?? "—"}</td>
                    <td className="px-3 py-2">{row.warehouse}</td>
                    <td className="px-3 py-2">{row.receipt_date}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{received}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{rejected}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  )
}
