import type { Metadata } from "next"
import Link from "next/link"

import { AccountingNav } from "@/components/accounting/accounting-nav"
import { PageShell } from "@/components/layout/page-shell"

export const metadata: Metadata = { title: "Accounting" }

const cellClass =
  "flex min-h-11 items-center justify-center border border-[#D0D5DD] bg-[#F2F4F7] px-2 py-3 text-center text-[13px] leading-snug text-[#1A1A1A]"

const bandTitleClass =
  "bg-[#1B3A6B] px-3 py-2 text-center text-[12px] font-semibold tracking-[0.04em] text-white uppercase"

type DiagramCell = {
  label: string
  href?: string
}

const masterData: DiagramCell[] = [
  { label: "Vendor Master", href: "/dashboard/contacts" },
  { label: "Customer Master", href: "/dashboard/contacts" },
  { label: "COA", href: "/dashboard/accounting/accounts" },
  { label: "Tax", href: "/dashboard/accounting/tax" },
  { label: "Bank Master", href: "/dashboard/accounting/banks" },
]

const transactionModules: DiagramCell[] = [
  { label: "P2P", href: "/dashboard/ap" },
  { label: "O2C", href: "/dashboard/ar" },
  { label: "Payroll" },
  { label: "Fixed Assets" },
  { label: "Treasury" },
  { label: "Inventory" },
]

const reportingLayer: DiagramCell[] = [
  { label: "Trial Balance", href: "/dashboard/accounting/trial-balance" },
  { label: "P&L", href: "/dashboard/accounting/profit-and-loss" },
  { label: "Balance Sheet", href: "/dashboard/accounting/balance-sheet" },
  { label: "Cash Flow", href: "/dashboard/accounting/cash" },
]

function DownArrow() {
  return (
    <div className="flex justify-center py-3" aria-hidden="true">
      <span className="block h-0 w-0 border-x-[5px] border-t-[8px] border-x-transparent border-t-[#1B3A6B]" />
    </div>
  )
}

function Band({
  title,
  cells,
  columns,
}: {
  title: string
  cells: DiagramCell[]
  columns: 1 | 4 | 5 | 6
}) {
  const columnsClass = {
    1: "md:grid-cols-1",
    4: "md:grid-cols-4",
    5: "md:grid-cols-5",
    6: "md:grid-cols-6",
  }[columns]

  return (
    <section className="w-full min-w-0">
      <h3 className={bandTitleClass}>{title}</h3>
      <div className={`grid grid-cols-1 ${columnsClass}`}>
        {cells.map((cell) =>
          cell.href ? (
            <Link
              key={`${cell.label}-${cell.href}`}
              href={cell.href}
              className={`${cellClass} hover:bg-[#E6EBF2]`}
            >
              {cell.label}
            </Link>
          ) : (
            <div key={cell.label} className={cellClass}>
              {cell.label}
            </div>
          )
        )}
      </div>
    </section>
  )
}

export default function AccountingPage() {
  return (
    <PageShell
      title="Accounting"
      description="Business transactions post into the ledger. Reports are read from the ledger."
    >
      <AccountingNav />
      <div className="w-full min-w-0 overflow-x-hidden">
        <h2 className="text-left text-[22px] font-semibold text-[#1B3A6B]">
          1. Accounting System Overview
        </h2>
        <div className="mt-2 h-0 w-full border-t-[2px] border-[#2E75B6]" />

        <p className="mt-4 text-left text-[14px] text-[#1A1A1A]">
          An enterprise accounting platform is usually built on two layers:
        </p>

        <div className="mt-4 grid w-full grid-cols-1 border border-[#D0D5DD] sm:grid-cols-2">
          <div className="min-w-0">
            <div className="bg-[#1B3A6B] px-3 py-2.5 text-left text-[14px] font-semibold text-white">
              Operational Layer
            </div>
            <div className="bg-white px-4 py-3 text-left align-top text-[14px] text-[#1A1A1A]">
              <p>Where business transactions originate.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Vendor onboarding</li>
                <li>Purchase requests</li>
                <li>Purchase orders</li>
                <li>Invoice processing</li>
                <li>Customer billing</li>
                <li>Bank transactions</li>
              </ul>
            </div>
          </div>
          <div className="min-w-0 border-t border-[#D0D5DD] sm:border-t-0 sm:border-l">
            <div className="bg-[#1B3A6B] px-3 py-2.5 text-left text-[14px] font-semibold text-white">
              Accounting Layer
            </div>
            <div className="bg-white px-4 py-3 text-left align-top text-[14px] text-[#1A1A1A]">
              <p>Where accounting entries are generated and posted.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Journal entries</li>
                <li>General ledger postings</li>
                <li>Trial balance</li>
                <li>Financial statements</li>
              </ul>
            </div>
          </div>
        </div>

        <h3 className="mt-7 text-left text-[18px] font-semibold text-[#2E75B6]">
          Overall Accounting Architecture (ERP Platform)
        </h3>

        <div className="mt-4">
          <Band title="Master Data" cells={masterData} columns={5} />
          <DownArrow />
          <Band title="Transaction Modules" cells={transactionModules} columns={6} />
          <DownArrow />
          <Band
            title="Accounting Engine"
            cells={[
              {
                label: "Journal Entry Generation & Validation",
                href: "/dashboard/accounting/journals",
              },
            ]}
            columns={1}
          />
          <DownArrow />
          <Band
            title="General Ledger"
            cells={[{ label: "General Ledger", href: "/dashboard/accounting/journals" }]}
            columns={1}
          />
          <DownArrow />
          <Band title="Reporting Layer" cells={reportingLayer} columns={4} />
        </div>
      </div>
    </PageShell>
  )
}
