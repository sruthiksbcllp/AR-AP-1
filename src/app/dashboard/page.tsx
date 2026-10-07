import type { Metadata } from "next"
import Link from "next/link"

import { AgingSummaryTable } from "@/components/dashboard/aging-summary-table"
import { AuditTrailFeed } from "@/components/dashboard/audit-trail-feed"
import { HighPriorityOverdueList } from "@/components/dashboard/high-priority-overdue-list"
import { OverviewKpiCards } from "@/components/dashboard/overview-kpi-cards"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { getLoggedInDisplayName } from "@/lib/auth/org"
import {
  getAuditTrail,
  getExecutiveOverview,
} from "@/lib/dashboard/queries"

export const metadata: Metadata = {
  title: "Executive Overview",
}

export default async function DashboardOverviewPage() {
  const [overview, audit, displayName] = await Promise.all([
    getExecutiveOverview(),
    getAuditTrail(8),
    getLoggedInDisplayName(),
  ])

  return (
    <PageShell
      title="Executive overview"
      greeting={`Welcome, ${displayName}!`}
      description="Outstanding AR/AP, working capital, aging risk, and compliance activity."
    >
      {overview.error ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between dark:text-amber-200">
          <p>{overview.error}</p>
          {overview.error.includes("/login") ? (
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <OverviewKpiCards kpis={overview.kpis} />

      <div className="grid gap-4 xl:grid-cols-2">
        <AgingSummaryTable
          title="AR aging breakdown"
          description="Open customer invoices by days past due."
          buckets={overview.arAging}
        />
        <AgingSummaryTable
          title="AP aging breakdown"
          description="Open vendor bills by days past due."
          buckets={overview.apAging}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <HighPriorityOverdueList items={overview.highPriorityItems} />
        <div className="space-y-3">
          <AuditTrailFeed logs={audit.logs} error={audit.error} compact />
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/audit">Open audit trail</Link>
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
