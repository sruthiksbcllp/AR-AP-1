import type { Metadata } from "next"

import { ApManagement } from "@/components/ap/ap-management"
import { BillsDataTable } from "@/components/ap/bills-data-table"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import { canProposePayment } from "@/lib/auth/roles"
import { getBills } from "@/lib/ap/queries"

export const metadata: Metadata = {
  title: "Accounts Payable",
}

export default async function AccountsPayablePage() {
  const [{ bills, error }, auth] = await Promise.all([
    getBills(),
    requireOrgContext(),
  ])
  const canHold = auth.ok && canProposePayment(auth.ctx.role)

  return (
    <PageShell
      title="Accounts Payable"
      description="Outstanding vendor balances, due dates, ageing, holds, and reconciliations."
    >
      <P2pNav />
      <ApManagement bills={bills} canHold={canHold} />
      <BillsDataTable data={bills} error={error} />
    </PageShell>
  )
}
