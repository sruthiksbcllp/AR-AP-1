import type { Metadata } from "next"
import Link from "next/link"

import { ContactsNav } from "@/components/contacts/contacts-nav"
import { VendorOnboardingForm } from "@/components/contacts/vendor-onboarding-form"
import { VendorWorkflow } from "@/components/contacts/vendor-workflow"
import { PageShell } from "@/components/layout/page-shell"
import { requireOrgContext } from "@/lib/auth/org"
import { canSubmitVendorOnboarding } from "@/lib/auth/roles"

export const metadata: Metadata = {
  title: "Onboard vendor",
}

export default async function NewVendorPage() {
  const auth = await requireOrgContext()
  const allowed = auth.ok && canSubmitVendorOnboarding(auth.ctx.role)

  return (
    <PageShell
      title="Onboard vendor"
      description="Capture the supplier master, then send it to Procurement Review."
    >
      <ContactsNav view="vendors" />
      <VendorWorkflow status={null} />
      {allowed ? (
        <VendorOnboardingForm />
      ) : (
        <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
          Your role cannot submit a vendor. A business user or admin must
          complete this form.{" "}
          <Link href="/dashboard/contacts" className="underline underline-offset-2">
            Back to vendor master
          </Link>
        </p>
      )}
    </PageShell>
  )
}
