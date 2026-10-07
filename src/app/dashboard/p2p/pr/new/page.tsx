import type { Metadata } from "next"

import { PrForm } from "@/components/p2p/p2p-forms"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { getCatalogItems } from "@/lib/p2p/queries"

export const metadata: Metadata = { title: "New purchase requisition" }

export default async function NewPrPage() {
  const { items, error } = await getCatalogItems()
  const goods = items.filter((item) => item.is_active)

  return (
    <PageShell
      title="New purchase requisition"
      description="Example: Marketing requests 5 laptops, a printer, or an annual software subscription."
    >
      <P2pNav />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {goods.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add catalog items before raising a PR.</p>
      ) : (
        <PrForm items={goods} />
      )}
    </PageShell>
  )
}
