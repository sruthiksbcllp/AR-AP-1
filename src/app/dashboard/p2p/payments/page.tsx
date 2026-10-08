import type { Metadata } from "next"

import { PaymentAdvanceButton } from "@/components/p2p/p2p-actions"
import { PaymentProposalForm } from "@/components/p2p/p2p-forms"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import {
  canApprovePayment,
  canPayVendor,
  canProposePayment,
} from "@/lib/auth/roles"
import { getPayableBills, getPaymentProposals } from "@/lib/p2p/queries"
import { formatINR } from "@/lib/currency"

export const metadata: Metadata = { title: "Payments" }

export default async function PaymentsPage() {
  const [{ rows, error }, payable, auth] = await Promise.all([
    getPaymentProposals(),
    getPayableBills(),
    requireOrgContext(),
  ])
  const role = auth.ok ? auth.ctx.role : null

  return (
    <PageShell
      title="Payments"
      description="Due invoice, payment proposal, finance approval, bank payment, and payment confirmation."
    >
      <P2pNav />
      <ol className="grid gap-2 sm:grid-cols-5">
        {["Due invoice", "Payment proposal", "Finance approval", "Bank payment", "Payment confirmation"].map(
          (label, index) => (
            <li key={label} className="rounded-lg border bg-muted/20 px-3 py-3">
              <p className="text-xs text-muted-foreground">{index + 1}</p>
              <p className="text-sm font-medium">{label}</p>
            </li>
          )
        )}
      </ol>
      {role && canProposePayment(role) ? <PaymentProposalForm bills={payable.rows} /> : null}
      {error ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Invoice</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No payment proposals yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const canAdvance =
                  role &&
                  ((row.status === "proposed" && canApprovePayment(role)) ||
                    ((row.status === "finance_approved" || row.status === "paid") &&
                      canPayVendor(role)))
                return (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{row.bill_number ?? "Invoice"}</td>
                    <td className="px-3 py-2">{row.vendor_name ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatINR(row.amount)}</td>
                    <td className="px-3 py-2 capitalize">{row.status.replaceAll("_", " ")}</td>
                    <td className="px-3 py-2">
                      {canAdvance ? <PaymentAdvanceButton id={row.id} status={row.status} /> : null}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <section className="rounded-xl border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">When payment is confirmed</p>
        <ul className="mt-2 list-disc pl-5">
          <li>PO closed</li>
          <li>Invoice closed</li>
          <li>Vendor balance cleared</li>
          <li>Accounting updated (AP debit / Bank credit)</li>
        </ul>
      </section>
    </PageShell>
  )
}
