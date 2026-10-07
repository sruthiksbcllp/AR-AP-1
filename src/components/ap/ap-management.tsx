"use client"

import { BillHoldButton } from "@/components/p2p/p2p-actions"
import { formatINR } from "@/lib/currency"
import type { BillListItem } from "@/types/bills"

function bucket(dueDate: string) {
  const days = Math.floor((Date.now() - new Date(`${dueDate}T00:00:00`).getTime()) / 86_400_000)
  if (days <= 30) return "0–30 Days"
  if (days <= 60) return "31–60 Days"
  if (days <= 90) return "61–90 Days"
  return "90+ Days"
}

const BUCKETS = ["0–30 Days", "31–60 Days", "61–90 Days", "90+ Days"] as const

export function ApManagement({
  bills,
  canHold,
}: {
  bills: BillListItem[]
  canHold: boolean
}) {
  const open = bills.filter((bill) => bill.balance_due > 0 && bill.status !== "rejected")
  const totals = Object.fromEntries(BUCKETS.map((label) => [label, 0])) as Record<(typeof BUCKETS)[number], number>
  for (const bill of open) {
    totals[bucket(bill.due_date)] += bill.balance_due
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-semibold">AP ageing buckets</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {BUCKETS.map((label) => (
            <div key={label} className="rounded-lg border bg-muted/20 px-3 py-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold tabular-nums">{formatINR(totals[label])}</p>
            </div>
          ))}
        </div>
      </section>
      {canHold && open.length > 0 ? (
        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Hold invoices</h2>
          <ul className="mt-3 space-y-2">
            {open.slice(0, 8).map((bill) => (
              <li key={bill.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {bill.bill_number}
                  {bill.on_hold ? " · on hold" : ""}
                </span>
                <BillHoldButton id={bill.id} onHold={bill.on_hold} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
