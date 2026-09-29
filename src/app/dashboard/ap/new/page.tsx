import type { Metadata } from "next"

import { BillCreateForm } from "@/components/ap/bill-create-form"
import { PageShell } from "@/components/layout/page-shell"
import { getVendorOptions } from "@/lib/ap/queries"

export const metadata: Metadata = {
  title: "New Bill",
}

export const maxDuration = 60

export default async function NewBillPage({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string; memo?: string; amount?: string }>
}) {
  const params = await searchParams
  const { vendors, error } = await getVendorOptions()
  const amount = Number(params.amount)
  const memo = params.memo?.trim().slice(0, 160) ?? ""

  return (
    <PageShell
      title="Create bill"
      description="Upload a vendor bill. The form fills vendor, due date, items, and total. Review before submitting."
    >
      <BillCreateForm
        vendors={vendors}
        vendorsError={error}
        initialVendorId={params.vendor}
        initialDescription={memo}
        initialAmount={Number.isFinite(amount) && amount > 0 ? String(amount) : ""}
      />
    </PageShell>
  )
}
