import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { PrDecisionButtons } from "@/components/p2p/p2p-actions"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import { canApprovePr, canCreatePo, canCreateRfq } from "@/lib/auth/roles"
import { getPurchaseRequisition } from "@/lib/p2p/queries"
import { formatINR } from "@/lib/currency"

export const metadata: Metadata = { title: "Purchase requisition" }

export default async function PrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [{ pr, error }, auth] = await Promise.all([
    getPurchaseRequisition(id),
    requireOrgContext(),
  ])
  if (!pr && error === "Purchase requisition not found.") notFound()
  if (!pr) {
    return (
      <PageShell title="Purchase requisition" description={error ?? undefined}>
        <Link href="/dashboard/p2p/pr">Back</Link>
      </PageShell>
    )
  }
  const role = auth.ok ? auth.ctx.role : null
  const canApprove = role && canApprovePr(role) && pr.status === "pending_manager"
  const canRfq = role && canCreateRfq(role) && pr.status === "approved"
  const canPo = role && canCreatePo(role) && (pr.status === "approved" || pr.status === "in_procurement")

  return (
    <PageShell title={pr.pr_number} description={`${pr.department} · ${pr.cost_center}`}>
      <P2pNav />
      <dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">Requester</dt>
          <dd>{pr.requester_email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Need by</dt>
          <dd>{pr.need_by_date ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Status</dt>
          <dd className="capitalize">{pr.status.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Estimated cost</dt>
          <dd className="tabular-nums">{formatINR(pr.estimated_cost)}</dd>
        </div>
        <div className="sm:col-span-3">
          <dt className="text-sm text-muted-foreground">Business justification</dt>
          <dd>{pr.business_justification}</dd>
        </div>
      </dl>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Item description</th>
              <th className="px-3 py-2 text-right font-medium">Quantity</th>
              <th className="px-3 py-2 text-right font-medium">Unit cost</th>
              <th className="px-3 py-2 text-right font-medium">Line total</th>
            </tr>
          </thead>
          <tbody>
            {pr.lines.map((line) => (
              <tr key={line.id} className="border-t">
                <td className="px-3 py-2">{line.description}</td>
                <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatINR(line.estimated_unit_cost)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatINR(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        {canApprove ? <PrDecisionButtons id={pr.id} /> : null}
        {canRfq ? (
          <Button asChild variant="outline">
            <Link href={`/dashboard/rfq?pr=${pr.id}&title=${encodeURIComponent(pr.lines[0]?.description ?? pr.pr_number)}`}>
              Create RFQ
            </Link>
          </Button>
        ) : null}
        {canPo ? (
          <Button asChild>
            <Link href={`/dashboard/p2p/po/new?pr=${pr.id}`}>Create PO</Link>
          </Button>
        ) : null}
      </div>
    </PageShell>
  )
}
