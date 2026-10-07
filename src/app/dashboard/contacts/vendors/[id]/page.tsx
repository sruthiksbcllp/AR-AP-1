import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { ContactsNav } from "@/components/contacts/contacts-nav"
import { VendorDetailCard } from "@/components/contacts/vendor-detail-card"
import { VendorReviewActions } from "@/components/contacts/vendor-review-actions"
import { VendorWorkflow } from "@/components/contacts/vendor-workflow"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import { getVendor } from "@/lib/contacts/queries"

export const metadata: Metadata = {
  title: "Vendor master",
}

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [{ vendor, error }, auth] = await Promise.all([
    getVendor(id),
    requireOrgContext(),
  ])

  if (!vendor && error === "This vendor was not found.") {
    notFound()
  }

  if (!vendor) {
    return (
      <PageShell title="Vendor master" description={error ?? undefined}>
        <Link href="/dashboard/contacts" className="text-sm underline">
          Back to vendor onboarding
        </Link>
      </PageShell>
    )
  }

  return (
    <PageShell
      title={vendor.name}
      description="Supplier master record. Procurement cannot start until status is Vendor created."
    >
      <ContactsNav view="vendors" />
      <VendorWorkflow status={vendor.vendor_status} />
      <VendorDetailCard vendor={vendor} />
      {auth.ok ? (
        <VendorReviewActions
          vendorId={vendor.id}
          status={vendor.vendor_status}
          role={auth.ctx.role}
        />
      ) : null}
      <Link
        href="/dashboard/contacts"
        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        Back to vendor onboarding
      </Link>
    </PageShell>
  )
}
