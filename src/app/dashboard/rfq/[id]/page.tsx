import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { P2pNav } from "@/components/p2p/p2p-nav"
import { RfqWorkspace } from "@/components/rfq/rfq-workspace"
import { PageShell } from "@/components/layout/page-shell"
import { getVendorOptions } from "@/lib/ap/queries"
import { getRfq } from "@/lib/rfq/queries"

export const metadata: Metadata = {
  title: "Quotation",
}

export default async function RfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [{ rfq, error }, vendorsResult] = await Promise.all([
    getRfq(id),
    getVendorOptions(),
  ])

  if (!rfq && error === "This request for quotation was not found.") {
    notFound()
  }

  if (!rfq) {
    return (
      <PageShell title="Request for quotation" description={error ?? undefined}>
        <Link href="/dashboard/rfq" className="text-sm underline">
          Back to requests
        </Link>
      </PageShell>
    )
  }

  return (
    <PageShell
      title={rfq.title}
      description="Record each vendor response, then select the lowest quote."
    >
      <P2pNav />
      <RfqWorkspace
        rfq={rfq}
        vendors={vendorsResult.vendors}
        vendorsError={vendorsResult.error}
      />
    </PageShell>
  )
}
