import type { Metadata } from "next"
import Link from "next/link"

import { ContactsDataTable } from "@/components/contacts/contacts-data-table"
import { ContactsNav } from "@/components/contacts/contacts-nav"
import { VendorMasterTable } from "@/components/contacts/vendor-master-table"
import { VendorWorkflow } from "@/components/contacts/vendor-workflow"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import { canSubmitVendorOnboarding } from "@/lib/auth/roles"
import { getContacts, getVendors } from "@/lib/contacts/queries"

export const metadata: Metadata = {
  title: "Contacts",
}

export default async function DashboardContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const params = await searchParams
  const view = params.view === "customers" ? "customers" : "vendors"
  const auth = await requireOrgContext()
  const canSubmit = auth.ok && canSubmitVendorOnboarding(auth.ctx.role)

  if (view === "customers") {
    const { contacts, error } = await getContacts("customer")
    return (
      <PageShell
        title="Contacts (Vendors/Clients)"
        description="Customer directory. Vendors must complete onboarding before procurement."
      >
        <ContactsNav view="customers" />
        <ContactsDataTable data={contacts} error={error} />
      </PageShell>
    )
  }

  const { vendors, error } = await getVendors()

  return (
    <PageShell
      title="Vendor Onboarding"
      description="Create a supplier master record before any procurement activity can occur."
    >
      <ContactsNav view="vendors" />
      <VendorWorkflow status={null} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Business user submits the master, then Procurement, Finance, and
          Compliance review it. Onboarded vendors appear on purchase
          requisitions. Only a created vendor can be used on RFQs, purchase
          orders, and bills.
        </p>
        {canSubmit ? (
          <Button asChild>
            <Link href="/dashboard/contacts/vendors/new">Onboard vendor</Link>
          </Button>
        ) : null}
      </div>
      <VendorMasterTable vendors={vendors} error={error} />
    </PageShell>
  )
}
