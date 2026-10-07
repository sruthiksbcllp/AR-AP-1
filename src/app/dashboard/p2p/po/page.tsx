import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import { canCreatePo, poApproverLabel } from "@/lib/auth/roles"
import { getPurchaseOrders } from "@/lib/p2p/queries"
import { formatINR } from "@/lib/currency"

export const metadata: Metadata = { title: "Purchase Order" }

export default async function PoListPage() {
  const [{ rows, error }, auth] = await Promise.all([
    getPurchaseOrders(),
    requireOrgContext(),
  ])
  const canCreate = auth.ok && canCreatePo(auth.ctx.role)

  return (
    <PageShell
      title="Purchase Order (PO)"
      description="A legally binding purchase document issued to a vendor."
    >
      <P2pNav />
      <div className="flex justify-end">
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/p2p/po/new">New PO</Link>
          </Button>
        ) : null}
      </div>
      {error ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">PO number</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Approver band</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No purchase orders yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/p2p/po/${row.id}`} className="font-medium hover:underline">
                      {row.po_number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.vendor_name ?? "—"}</td>
                  <td className="px-3 py-2 capitalize">{row.status.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2">{poApproverLabel(row.total_amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(row.total_amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Approval matrix</h2>
        <table className="mt-2 w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1">PO value (₹)</th>
              <th className="py-1">Approver</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t"><td className="py-1">0 – 50,000</td><td>Manager</td></tr>
            <tr className="border-t"><td className="py-1">50,001 – 500,000</td><td>Director</td></tr>
            <tr className="border-t"><td className="py-1">Above 500,000</td><td>CFO</td></tr>
          </tbody>
        </table>
      </section>
    </PageShell>
  )
}
