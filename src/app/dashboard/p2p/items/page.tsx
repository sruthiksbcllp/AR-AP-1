import type { Metadata } from "next"

import { CatalogTable } from "@/components/p2p/catalog-table"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import { canWriteCatalog } from "@/lib/auth/roles"
import { getCatalogItems } from "@/lib/p2p/queries"

export const metadata: Metadata = { title: "Item catalog" }

export default async function CatalogPage() {
  const [{ items, error }, auth] = await Promise.all([
    getCatalogItems(),
    requireOrgContext(),
  ])
  return (
    <PageShell
      title="Item catalog"
      description="Search, filter, and maintain goods and services. 100 sample laptops are loaded for the Accounts Payable demo."
    >
      <P2pNav />
      <CatalogTable
        items={items}
        error={error}
        canWrite={auth.ok && canWriteCatalog(auth.ctx.role)}
      />
    </PageShell>
  )
}
