import type { Metadata } from "next"

import { InvoiceCreateForm } from "@/components/ar/invoice-create-form"
import { PageShell } from "@/components/layout/page-shell"
import { getCustomerOptions } from "@/lib/ar/queries"

export const metadata: Metadata = {
  title: "New Invoice",
}

export const maxDuration = 60

export default async function NewInvoicePage() {
  const { customers, error } = await getCustomerOptions()

  return (
    <PageShell
      title="Create invoice"
      description="Upload a customer invoice. The form fills the customer, dates, items, and total. Review before creating."
    >
      <InvoiceCreateForm customers={customers} customersError={error} />
    </PageShell>
  )
}
