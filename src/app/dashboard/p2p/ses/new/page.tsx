import type { Metadata } from "next"

import { SesForm } from "@/components/p2p/p2p-forms"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { getPurchaseOrders } from "@/lib/p2p/queries"

export const metadata: Metadata = { title: "New SES" }

export default async function NewSesPage() {
  const { rows, error } = await getPurchaseOrders()
  const pos = rows.filter((row) => row.status === "released" || row.status === "approved")

  return (
    <PageShell title="Record service performed" description="Confirm delivery of a service against a released PO.">
      <P2pNav />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {pos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Release a purchase order before recording a service entry.</p>
      ) : (
        <SesForm pos={pos} />
      )}
    </PageShell>
  )
}
