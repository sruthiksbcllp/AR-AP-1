import type { Metadata } from "next"

import { PoForm } from "@/components/p2p/p2p-forms"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { getVendorOptions } from "@/lib/ap/queries"
import { getCatalogItems, getPurchaseRequisition } from "@/lib/p2p/queries"

export const metadata: Metadata = { title: "New purchase order" }

export default async function NewPoPage({
  searchParams,
}: {
  searchParams: Promise<{ pr?: string; rfq?: string; vendor?: string; qty?: string; rate?: string }>
}) {
  const params = await searchParams
  const [{ items }, vendors, pr] = await Promise.all([
    getCatalogItems(),
    getVendorOptions(),
    params.pr ? getPurchaseRequisition(params.pr) : Promise.resolve({ pr: null }),
  ])

  return (
    <PageShell
      title="Create purchase order"
      description="Approved PR → vendor selection → PO creation → approval workflow → PO released."
    >
      <P2pNav />
      {vendors.error ? <p className="text-sm text-destructive">{vendors.error}</p> : null}
      <PoForm
        vendors={vendors.vendors}
        items={items.filter((item) => item.is_active)}
        defaultPrId={params.pr}
        defaultRfqId={params.rfq}
        defaultVendorId={params.vendor ?? pr.pr?.vendor_id ?? undefined}
        defaultQty={params.qty}
        defaultRate={params.rate}
      />
    </PageShell>
  )
}
