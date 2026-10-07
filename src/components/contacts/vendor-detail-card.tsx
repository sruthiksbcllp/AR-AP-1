import { VendorStatusBadge } from "@/components/contacts/vendor-status-badge"
import type { VendorMaster } from "@/types/contacts"

function Row({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="grid gap-1 border-b py-2 last:border-b-0 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{value || "—"}</dd>
    </div>
  )
}

function Group({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border p-4">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <dl>{children}</dl>
    </section>
  )
}

export function VendorDetailCard({ vendor }: { vendor: VendorMaster }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {vendor.vendor_code ?? "—"}
          </p>
          <h2 className="text-lg font-semibold">{vendor.name}</h2>
          {vendor.trade_name && vendor.trade_name !== vendor.name ? (
            <p className="text-sm text-muted-foreground">{vendor.trade_name}</p>
          ) : null}
        </div>
        <VendorStatusBadge status={vendor.vendor_status} />
      </div>

      <Group title="General information">
        <Row label="Vendor legal name" value={vendor.name} />
        <Row label="Trade name" value={vendor.trade_name} />
        <Row label="Address" value={vendor.address} />
        <Row label="Country" value={vendor.country} />
        <Row
          label="Business registration number"
          value={vendor.business_registration_number}
        />
      </Group>

      <Group title="Tax information">
        <Row label="PAN" value={vendor.pan} />
        <Row label="GSTIN" value={vendor.gstin ?? vendor.tax_id} />
        <Row
          label="Tax residency certificate"
          value={vendor.tax_residency_certificate}
        />
      </Group>

      <Group title="Contact information">
        <Row label="Contact person" value={vendor.contact_person} />
        <Row label="Phone number" value={vendor.phone} />
        <Row label="Email" value={vendor.email} />
      </Group>

      <Group title="Banking information">
        <Row label="Bank name" value={vendor.bank_name} />
        <Row label="Beneficiary name" value={vendor.beneficiary_name} />
        <Row label="Account number" value={vendor.account_number} />
        <Row label="IFSC / SWIFT" value={vendor.ifsc_swift} />
      </Group>

      <Group title="Commercial information">
        <Row label="Payment terms" value={vendor.payment_terms} />
        <Row label="Currency" value={vendor.currency} />
        <Row
          label="Credit period"
          value={
            vendor.credit_period_days == null
              ? null
              : `${vendor.credit_period_days} days`
          }
        />
      </Group>

      <Group title="Vendor master">
        <Row label="Vendor_ID" value={vendor.id} />
        <Row label="Vendor_Code" value={vendor.vendor_code} />
        <Row label="Created_By" value={vendor.created_by_email} />
        <Row
          label="Created_Date"
          value={new Date(vendor.created_at).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        />
      </Group>
    </div>
  )
}
