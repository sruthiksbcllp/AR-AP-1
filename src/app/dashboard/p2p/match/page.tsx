import type { Metadata } from "next"

import { MatchAdvanceButton } from "@/components/p2p/p2p-actions"
import { MatchRunForm } from "@/components/p2p/p2p-forms"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import { canMatchInvoice } from "@/lib/auth/roles"
import { getMatches, getUnmatchedBills } from "@/lib/p2p/queries"

export const metadata: Metadata = { title: "Three-way matching" }

export default async function MatchPage() {
  const [{ rows, error }, unmatched, auth] = await Promise.all([
    getMatches(),
    getUnmatchedBills(),
    requireOrgContext(),
  ])
  const canRun = auth.ok && canMatchInvoice(auth.ctx.role)

  return (
    <PageShell
      title="Three-way matching"
      description="The system validates that the purchase order, goods receipt, and vendor invoice agree."
    >
      <P2pNav />
      <div className="grid gap-2 sm:grid-cols-3">
        {["Purchase order", "= Goods receipt", "= Vendor invoice"].map((label) => (
          <div key={label} className="rounded-lg border bg-muted/20 px-3 py-3 text-center text-sm font-medium">
            {label}
          </div>
        ))}
      </div>
      {unmatched.error ? <p className="text-sm text-destructive">{unmatched.error}</p> : null}
      {canRun ? <MatchRunForm bills={unmatched.rows} /> : null}
      {error ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Invoice</th>
              <th className="px-3 py-2 font-medium">PO</th>
              <th className="px-3 py-2 text-right font-medium">PO qty</th>
              <th className="px-3 py-2 text-right font-medium">GRN qty</th>
              <th className="px-3 py-2 text-right font-medium">Invoice qty</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No match runs yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{row.bill_number ?? "Invoice"}</td>
                  <td className="px-3 py-2">{row.po_number ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.po_qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.grn_qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.invoice_qty}</td>
                  <td className="px-3 py-2 uppercase">
                    {row.status === "pass" ? "PASS" : "EXCEPTION"}
                    {row.status === "exception" && row.exception_stage
                      ? ` · ${row.exception_stage}`
                      : ""}
                  </td>
                  <td className="px-3 py-2">
                    {row.status === "exception" ? (
                      <MatchAdvanceButton id={row.id} stage={row.exception_stage} />
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
