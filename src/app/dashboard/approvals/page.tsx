import type { Metadata } from "next"
import Link from "next/link"

import { ApprovalsPanel } from "@/components/ap/approvals-panel"
import { PageShell } from "@/components/layout/page-shell"
import { getPendingApprovalBills } from "@/lib/ap/queries"
import { formatINR } from "@/lib/currency"
import {
  getMatches,
  getPaymentProposals,
  getPurchaseOrders,
  getPurchaseRequisitions,
  getServiceEntries,
} from "@/lib/p2p/queries"

export const metadata: Metadata = {
  title: "Approvals",
}

export default async function ApprovalsPage() {
  const [billsResult, prs, pos, ses, matches, payments] = await Promise.all([
    getPendingApprovalBills(),
    getPurchaseRequisitions(),
    getPurchaseOrders(),
    getServiceEntries(),
    getMatches(),
    getPaymentProposals(),
  ])
  const pendingPrs = prs.rows.filter((row) => row.status === "pending_manager")
  const pendingPos = pos.rows.filter((row) => row.status === "pending_approval")
  const pendingSes = ses.rows.filter(
    (row) => row.status === "confirmed" || row.status === "manager_review"
  )
  const pendingMatch = matches.rows.filter((row) => row.status === "exception")
  const pendingPay = payments.rows.filter(
    (row) => row.status === "proposed" || row.status === "finance_approved" || row.status === "paid"
  )

  return (
    <PageShell
      title="Approval Center"
      description="Review PRs, POs, vendor bills, SES, match exceptions, and payment proposals."
    >
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Purchase requisitions", pendingPrs.length, "/dashboard/p2p/pr"],
          ["Purchase orders", pendingPos.length, "/dashboard/p2p/po"],
          ["Service entries", pendingSes.length, "/dashboard/p2p/ses"],
          ["Match exceptions", pendingMatch.length, "/dashboard/p2p/match"],
          ["Payments", pendingPay.length, "/dashboard/p2p/payments"],
        ].map(([label, count, href]) => (
          <Link key={String(label)} href={String(href)} className="rounded-xl border p-4 hover:bg-muted/40">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tabular-nums">{count}</p>
          </Link>
        ))}
      </section>
      {pendingPrs.length > 0 ? (
        <ul className="rounded-xl border p-4 text-sm">
          {pendingPrs.map((row) => (
            <li key={row.id} className="flex justify-between gap-3 border-b py-2 last:border-0">
              <Link href={`/dashboard/p2p/pr/${row.id}`} className="hover:underline">
                {row.pr_number} · {row.department}
              </Link>
              <span className="tabular-nums">{formatINR(row.estimated_cost)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {pendingPos.length > 0 ? (
        <ul className="rounded-xl border p-4 text-sm">
          {pendingPos.map((row) => (
            <li key={row.id} className="flex justify-between gap-3 border-b py-2 last:border-0">
              <Link href={`/dashboard/p2p/po/${row.id}`} className="hover:underline">
                {row.po_number} · {row.vendor_name}
              </Link>
              <span className="tabular-nums">{formatINR(row.total_amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <ApprovalsPanel
        bills={billsResult.bills}
        canApprove={billsResult.canApprove}
        role={billsResult.role}
        error={billsResult.error}
      />
    </PageShell>
  )
}
