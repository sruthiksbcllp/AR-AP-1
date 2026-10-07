import type { Metadata } from "next"

import { GrnForm } from "@/components/p2p/p2p-forms"
import { P2pNav } from "@/components/p2p/p2p-nav"
import { PageShell } from "@/components/layout/page-shell"
import { getPurchaseOrders } from "@/lib/p2p/queries"

export const metadata: Metadata = { title: "New GRN" }

export default async function NewGrnPage() {
  const { rows, error } = await getPurchaseOrders()
  const pos = rows.filter((row) => row.status === "released" || row.status === "approved")

  return (
    <PageShell
      title="Create goods receipt"
      description="PO → goods delivered → warehouse inspection → GRN creation. Example: ordered 100, received 95, rejected 5."
    >
      <P2pNav />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {pos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Release a purchase order before recording a GRN.</p>
      ) : (
        <GrnForm pos={pos} />
      )}
    </PageShell>
  )
}
