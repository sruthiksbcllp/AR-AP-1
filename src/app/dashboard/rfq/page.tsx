import type { Metadata } from "next"

import { P2pNav } from "@/components/p2p/p2p-nav"
import { RfqBoard } from "@/components/rfq/rfq-board"
import { PageShell } from "@/components/layout/page-shell"
import { getRfqs } from "@/lib/rfq/queries"

export const metadata: Metadata = {
  title: "Request for Quotation",
}

export default async function RfqPage({
  searchParams,
}: {
  searchParams: Promise<{ pr?: string; title?: string }>
}) {
  const params = await searchParams
  const { rfqs, error } = await getRfqs()

  return (
    <PageShell
      title="Request for Quotation (RFQ)"
      description="Obtain quotations from multiple vendors, then select the lowest quote."
    >
      <P2pNav />
      <RfqBoard
        rfqs={rfqs}
        error={error}
        initialTitle={params.title}
        prId={params.pr}
      />
    </PageShell>
  )
}
