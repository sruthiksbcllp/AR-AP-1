import type { Metadata } from "next"

import { CatalogForm } from "@/components/p2p/catalog-table"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"

export const metadata: Metadata = { title: "Add item" }

export default function NewCatalogItemPage() {
  return (
    <PageShell title="Add item" description="Add a catalog item for PR and PO lines.">
      <P2pNav />
      <CatalogForm />
    </PageShell>
  )
}
