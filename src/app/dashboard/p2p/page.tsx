import type { Metadata } from "next"
import Link from "next/link"

import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { getP2pCounts } from "@/lib/p2p/queries"

export const metadata: Metadata = { title: "Procure to Pay" }

const FLOW = [
  { n: 1, label: "Vendor Onboarding", href: "/dashboard/contacts" },
  { n: 2, label: "Purchase Requisition", href: "/dashboard/p2p/pr" },
  { n: 3, label: "RFQ / Quotation", href: "/dashboard/rfq" },
  { n: 4, label: "Purchase Order", href: "/dashboard/p2p/po" },
  { n: 5, label: "GRN / SES", href: "/dashboard/p2p/grn" },
  { n: 6, label: "Vendor Invoice", href: "/dashboard/ap" },
  { n: 7, label: "3-Way Match", href: "/dashboard/p2p/match" },
  { n: 8, label: "Accounting Entry", href: "/dashboard/accounting/journals" },
  { n: 9, label: "AP Management", href: "/dashboard/ap" },
  { n: 10, label: "Payment Proposal", href: "/dashboard/p2p/payments" },
  { n: 11, label: "Finance Approval", href: "/dashboard/p2p/payments" },
  { n: 12, label: "Bank Payment", href: "/dashboard/p2p/payments" },
  { n: 13, label: "Payment Confirmation", href: "/dashboard/p2p/payments" },
]

export default async function P2pPage() {
  const counts = await getP2pCounts()

  return (
    <PageShell
      title="Procure to Pay"
      description="Vendor creation through PR, RFQ, PO, receipt, matching, accounting, and payment close."
    >
      <P2pNav />
      {counts.error ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          {counts.error}
        </p>
      ) : null}
      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-semibold">What is Procure-to-Pay?</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Identifying a requirement</li>
          <li>Procuring goods/services</li>
          <li>Receiving goods/services</li>
          <li>Recording supplier invoices</li>
          <li>Paying suppliers</li>
          <li>Posting accounting entries</li>
        </ul>
      </section>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {FLOW.map((step) => (
          <Link
            key={`${step.n}-${step.label}`}
            href={step.href}
            className="rounded-lg border bg-muted/20 px-3 py-3 hover:bg-muted/40"
          >
            <p className="text-xs text-muted-foreground">{step.n}</p>
            <p className="text-sm font-medium">{step.label}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Items", counts.items, "/dashboard/p2p/items"],
          ["PRs", counts.prs, "/dashboard/p2p/pr"],
          ["POs", counts.pos, "/dashboard/p2p/po"],
          ["Payments", counts.payments, "/dashboard/p2p/payments"],
        ].map(([label, value, href]) => (
          <Link key={String(label)} href={String(href)} className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          </Link>
        ))}
      </div>
      <p className="rounded-xl border bg-muted/20 px-4 py-3 text-sm">
        After payment confirmation the PO is closed, the invoice is paid, the vendor balance is
        cleared, and the AP/Bank journal is posted — P2P completed.
      </p>
    </PageShell>
  )
}
