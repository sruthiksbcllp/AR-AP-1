import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { getGoodsReceipt } from "@/lib/p2p/queries"

export const metadata: Metadata = { title: "GRN" }

export default async function GrnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { grn, error } = await getGoodsReceipt(id)
  if (!grn && error === "Goods receipt not found.") notFound()
  if (!grn) {
    return (
      <PageShell title="GRN" description={error ?? undefined}>
        <Link href="/dashboard/p2p/grn">Back</Link>
      </PageShell>
    )
  }

  return (
    <PageShell title={grn.grn_number} description={`${grn.po_number ?? "PO"} · ${grn.warehouse}`}>
      <P2pNav />
      <p className="text-sm text-muted-foreground">Receipt date {grn.receipt_date}</p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">PO quantity</th>
              <th className="px-3 py-2 text-right font-medium">Received</th>
              <th className="px-3 py-2 text-right font-medium">Rejected</th>
            </tr>
          </thead>
          <tbody>
            {grn.lines.map((line) => (
              <tr key={line.id} className="border-t">
                <td className="px-3 py-2">{line.description}</td>
                <td className="px-3 py-2 text-right tabular-nums">{line.ordered_qty}</td>
                <td className="px-3 py-2 text-right tabular-nums">{line.received_qty}</td>
                <td className="px-3 py-2 text-right tabular-nums">{line.rejected_qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  )
}
