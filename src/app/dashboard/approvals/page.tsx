import type { Metadata } from "next"

import { ApprovalsPanel } from "@/components/ap/approvals-panel"
import { PageShell } from "@/components/layout/page-shell"
import { getPendingApprovalBills } from "@/lib/ap/queries"

export const metadata: Metadata = {
  title: "Approvals",
}

export default async function ApprovalsPage() {
  const { bills, canApprove, role, error } = await getPendingApprovalBills()

  return (
    <PageShell
      title="Approval Center"
      description="Review vendor bills awaiting Manager or Director / CFO decision."
    >
      <ApprovalsPanel
        bills={bills}
        canApprove={canApprove}
        role={role}
        error={error}
      />
    </PageShell>
  )
}
