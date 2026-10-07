import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { PoDecisionButtons } from "@/components/p2p/p2p-actions"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import { canApprovePoAmount, canCreateGrn, canCreateSes, poApproverLabel } from "@/lib/auth/roles"
import { getPurchaseOrder } from "@/lib/p2p/queries"
import { formatINR } from "@/lib/currency"

export const metadata: Metadata = { title: "Purchase order" }

export default async function PoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [{ po, error }, auth] = await Promise.all([
    getPurchaseOrder(id),
    requireOrgContext(),
  ])
  if (!po && error === "Purchase order not found.") notFound()
  if (!po) {
    return (
      <PageShell title="Purchase order" description={error ?? undefined}>
        <Link href="/dashboard/p2p/po">Back</Link>
      </PageShell>
    )
  }
  const role = auth.ok ? auth.ctx.role : null
  const canApprove =
    role && po.status === "pending_approval" && canApprovePoAmount(role, po.total_amount)
  const released = po.status === "released" || po.status === "approved"

  return (
    <PageShell title={po.po_number} description={po.vendor_name ?? "Vendor"}>
      <P2pNav />
      <dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-4">
        <div>
          <dt className="text-sm text-muted-foreground">Currency</dt>
          <dd>{po.currency}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Payment terms</dt>
          <dd>{po.payment_terms ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Delivery date</dt>
          <dd>{po.delivery_date ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Status</dt>
          <dd className="capitalize">{po.status.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Tax</dt>
          <dd className="tabular-nums">{formatINR(po.tax_amount)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Total amount</dt>
          <dd className="tabular-nums">{formatINR(po.total_amount)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Approver</dt>
          <dd>{poApproverLabel(po.total_amount)}</dd>
        </div>
      </dl>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Quantity</th>
              <th className="px-3 py-2 text-right font-medium">Rate</th>
              <th className="px-3 py-2 text-right font-medium">Tax %</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((line) => (
              <tr key={line.id} className="border-t">
                <td className="px-3 py-2">{line.description}</td>
                <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatINR(line.rate)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{line.tax_rate}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatINR(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        {canApprove ? <PoDecisionButtons id={po.id} /> : null}
        {released && role && canCreateGrn(role) ? (
          <Button asChild variant="outline">
            <Link href="/dashboard/p2p/grn/new">Create GRN</Link>
          </Button>
        ) : null}
        {released && role && canCreateSes(role) ? (
          <Button asChild variant="outline">
            <Link href="/dashboard/p2p/ses/new">Create SES</Link>
          </Button>
        ) : null}
        {released ? (
          <Button asChild>
            <Link href={`/dashboard/ap/new?po=${po.id}&vendor=${po.vendor_id}`}>Vendor invoice</Link>
          </Button>
        ) : null}
      </div>
    </PageShell>
  )
}
