import type { Metadata } from "next"

import { BillCreateForm } from "@/components/ap/bill-create-form"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { getVendorOptions } from "@/lib/ap/queries"
import { getPurchaseOrders } from "@/lib/p2p/queries"

export const metadata: Metadata = {
  title: "New Bill",
}

export const maxDuration = 60

export default async function NewBillPage({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string; memo?: string; amount?: string; po?: string }>
}) {
  const params = await searchParams
  const [{ vendors, error }, pos] = await Promise.all([getVendorOptions(), getPurchaseOrders()])
  const amount = Number(params.amount)
  const memo = params.memo?.trim().slice(0, 160) ?? ""
  const released = pos.rows
    .filter((row) => row.status === "released" || row.status === "approved")
    .map((row) => ({
      id: row.id,
      po_number: row.po_number,
      vendor_id: row.vendor_id,
    }))

  return (
    <PageShell
      title="Vendor Invoice Processing"
      description="Record the vendor's invoice in the accounting system, with invoice number, date, vendor, PO reference, tax, amount, currency, and due date."
    >
      <P2pNav />
      <BillCreateForm
        vendors={vendors}
        vendorsError={error}
        initialVendorId={params.vendor}
        initialDescription={memo}
        initialAmount={Number.isFinite(amount) && amount > 0 ? String(amount) : ""}
        purchaseOrders={released}
        initialPoId={params.po}
      />
    </PageShell>
  )
}
