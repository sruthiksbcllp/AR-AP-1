import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { CatalogForm } from "@/components/p2p/catalog-table"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import { canWriteCatalog } from "@/lib/auth/roles"
import { getCatalogItem } from "@/lib/p2p/queries"
import { formatINR } from "@/lib/currency"

export const metadata: Metadata = { title: "Item" }

export default async function CatalogItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [{ item, error }, auth] = await Promise.all([
    getCatalogItem(id),
    requireOrgContext(),
  ])
  if (!item && error === "Item not found.") notFound()
  if (!item) {
    return (
      <PageShell title="Item" description={error ?? undefined}>
        <Link href="/dashboard/p2p/items">Back</Link>
      </PageShell>
    )
  }
  const canWrite = auth.ok && canWriteCatalog(auth.ctx.role)
  return (
    <PageShell title={item.name} description={`${item.sku} · ${formatINR(item.standard_cost)}`}>
      <P2pNav />
      <dl className="grid gap-2 rounded-xl border p-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">SKU</dt>
          <dd className="font-mono text-sm">{item.sku}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Category</dt>
          <dd>{item.category}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Kind</dt>
          <dd>{item.item_kind}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Unit</dt>
          <dd>{item.unit}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-muted-foreground">Description</dt>
          <dd>{item.description ?? "—"}</dd>
        </div>
      </dl>
      {canWrite ? <CatalogForm item={item} /> : null}
    </PageShell>
  )
}
