"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { submitVendorOnboarding } from "@/app/dashboard/contacts/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DEFAULT_CURRENCY } from "@/lib/currency"
import {
  COUNTRY_OPTIONS,
  PAYMENT_TERM_OPTIONS,
} from "@/types/contacts"

const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP", "AED"] as const

function FieldGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4 rounded-xl border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}

function Field({
  id,
  label,
  children,
  className,
}: {
  id: string
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

export function VendorOnboardingForm() {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [country, setCountry] = React.useState("India")
  const [paymentTerms, setPaymentTerms] = React.useState("Net 30")
  const [currency, setCurrency] = React.useState<string>(DEFAULT_CURRENCY)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    formData.set("country", country)
    formData.set("payment_terms", paymentTerms)
    formData.set("currency", currency)

    const result = await submitVendorOnboarding(formData)
    setPending(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    router.push(`/dashboard/contacts/vendors/${result.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FieldGroup title="General information">
        <Field id="name" label="Vendor legal name">
          <Input
            id="name"
            name="name"
            placeholder="Acme Supplies Private Limited"
            required
            disabled={pending}
          />
        </Field>
        <Field id="trade_name" label="Trade name">
          <Input
            id="trade_name"
            name="trade_name"
            placeholder="Acme Supplies"
            disabled={pending}
          />
        </Field>
        <Field id="address" label="Address" className="md:col-span-2">
          <Textarea
            id="address"
            name="address"
            placeholder="Street, city, state, PIN"
            required
            disabled={pending}
          />
        </Field>
        <Field id="country" label="Country">
          <Select
            value={country}
            onValueChange={(value) => {
              if (value) setCountry(value)
            }}
            disabled={pending}
          >
            <SelectTrigger id="country" className="w-full">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_OPTIONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="business_registration_number" label="Business registration number">
          <Input
            id="business_registration_number"
            name="business_registration_number"
            placeholder="CIN / registration number"
            required
            disabled={pending}
          />
        </Field>
      </FieldGroup>

      <FieldGroup title="Tax information">
        <Field id="pan" label="PAN">
          <Input
            id="pan"
            name="pan"
            placeholder="ABCDE1234F"
            required
            disabled={pending}
          />
        </Field>
        <Field id="gstin" label="GSTIN">
          <Input
            id="gstin"
            name="gstin"
            placeholder="22AAAAA0000A1Z5"
            required
            disabled={pending}
          />
        </Field>
        <Field
          id="tax_residency_certificate"
          label="Tax residency certificate (if applicable)"
          className="md:col-span-2"
        >
          <Input
            id="tax_residency_certificate"
            name="tax_residency_certificate"
            placeholder="Certificate number or leave blank"
            disabled={pending}
          />
        </Field>
      </FieldGroup>

      <FieldGroup title="Contact information">
        <Field id="contact_person" label="Contact person">
          <Input
            id="contact_person"
            name="contact_person"
            placeholder="Priya Sharma"
            required
            disabled={pending}
          />
        </Field>
        <Field id="phone" label="Phone number">
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+91 98765 43210"
            required
            disabled={pending}
          />
        </Field>
        <Field id="email" label="Email" className="md:col-span-2">
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="ap@example.com"
            required
            disabled={pending}
          />
        </Field>
      </FieldGroup>

      <FieldGroup title="Banking information">
        <Field id="bank_name" label="Bank name">
          <Input
            id="bank_name"
            name="bank_name"
            placeholder="HDFC Bank"
            required
            disabled={pending}
          />
        </Field>
        <Field id="beneficiary_name" label="Beneficiary name">
          <Input
            id="beneficiary_name"
            name="beneficiary_name"
            placeholder="Acme Supplies Private Limited"
            required
            disabled={pending}
          />
        </Field>
        <Field id="account_number" label="Account number">
          <Input
            id="account_number"
            name="account_number"
            placeholder="XXXXXXXXXXXX"
            required
            disabled={pending}
          />
        </Field>
        <Field id="ifsc_swift" label="IFSC / SWIFT">
          <Input
            id="ifsc_swift"
            name="ifsc_swift"
            placeholder="HDFC0001234"
            required
            disabled={pending}
          />
        </Field>
      </FieldGroup>

      <FieldGroup title="Commercial information">
        <Field id="payment_terms" label="Payment terms">
          <Select
            value={paymentTerms}
            onValueChange={(value) => {
              if (value) setPaymentTerms(value)
            }}
            disabled={pending}
          >
            <SelectTrigger id="payment_terms" className="w-full">
              <SelectValue placeholder="Select terms" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_TERM_OPTIONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="currency" label="Currency">
          <Select
            value={currency}
            onValueChange={(value) => {
              if (value) setCurrency(value)
            }}
            disabled={pending}
          >
            <SelectTrigger id="currency" className="w-full">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                  {code === "INR" ? " (₹)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="credit_period_days" label="Credit period (days)">
          <Input
            id="credit_period_days"
            name="credit_period_days"
            type="number"
            min={0}
            step={1}
            defaultValue={30}
            required
            disabled={pending}
          />
        </Field>
      </FieldGroup>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/contacts">Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Submit for procurement review
        </Button>
      </div>
    </form>
  )
}
