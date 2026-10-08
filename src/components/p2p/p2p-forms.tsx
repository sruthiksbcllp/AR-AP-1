"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  createGoodsReceipt,
  createPaymentProposal,
  createPurchaseOrder,
  createPurchaseRequisition,
  createServiceEntry,
  runThreeWayMatch,
} from "@/app/dashboard/p2p/actions"
import { VendorCombobox } from "@/components/ap/vendor-combobox"
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
import { formatINR } from "@/lib/currency"
import { poApproverLabel } from "@/lib/auth/roles"
import { VENDOR_STATUS_LABELS } from "@/types/contacts"
import type { CatalogItem } from "@/types/p2p"
import type { VendorOption } from "@/lib/ap/queries"

type VendorOpt = { id: string; name: string }
type PoOpt = { id: string; po_number: string; status: string; lines: { id: string; description: string; quantity: number }[] }
type BillOpt = { id: string; bill_number: string; balance_due: number }

export function PrForm({
  items,
  vendors,
}: {
  items: CatalogItem[]
  vendors: VendorOption[]
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [vendorId, setVendorId] = React.useState(vendors.length === 1 ? vendors[0].id : "")
  const [itemId, setItemId] = React.useState(items[0]?.id ?? "")
  const selected = items.find((item) => item.id === itemId)
  const vendorChoices = vendors.map((vendor) => ({
    id: vendor.id,
    name:
      vendor.vendor_status && vendor.vendor_status !== "active"
        ? `${vendor.name} · ${VENDOR_STATUS_LABELS[vendor.vendor_status]}`
        : vendor.name,
    email: vendor.email,
  }))

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const formData = new FormData(event.currentTarget)
    formData.set("vendor_id", vendorId)
    formData.set("item_id", itemId)
    if (selected && !formData.get("description")) formData.set("description", selected.name)
    const result = await createPurchaseRequisition(formData)
    setPending(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    router.push(`/dashboard/p2p/pr/${result.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border p-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="vendor_id">Vendor</Label>
        <VendorCombobox
          vendors={vendorChoices}
          value={vendorId}
          onChange={setVendorId}
          disabled={pending || vendors.length === 0}
        />
        <p className="text-xs text-muted-foreground">
          Vendors come from Vendor Onboarding for this company. Finish reviews so the
          supplier shows as Vendor Created before a purchase order is issued.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="department">Department</Label>
        <Input id="department" name="department" required placeholder="Marketing" disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cost_center">Cost center</Label>
        <Input id="cost_center" name="cost_center" required placeholder="MKT-100" disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="need_by_date">Need by date</Label>
        <Input id="need_by_date" name="need_by_date" type="date" disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label>Catalog item</Label>
        <Select value={itemId} onValueChange={(value) => value && setItemId(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select item" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.sku} · {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="description">Item description</Label>
        <Input
          id="description"
          name="description"
          defaultValue={selected?.name}
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="quantity">Quantity</Label>
        <Input id="quantity" name="quantity" type="number" min={1} step="1" defaultValue={100} required disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="estimated_unit_cost">Estimated unit cost (₹)</Label>
        <Input
          id="estimated_unit_cost"
          name="estimated_unit_cost"
          type="number"
          min={0}
          step="0.01"
          defaultValue={selected?.standard_cost ?? 9500}
          disabled={pending}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="business_justification">Business justification</Label>
        <Textarea
          id="business_justification"
          name="business_justification"
          required
          placeholder="Marketing requests 100 laptops for the field team."
          disabled={pending}
        />
      </div>
      {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
      <div className="flex justify-end gap-2 md:col-span-2">
        <Button type="submit" disabled={pending || !vendorId}>
          Submit for manager approval
        </Button>
      </div>
    </form>
  )
}

export function PoForm({
  vendors,
  items,
  defaultPrId,
  defaultRfqId,
  defaultVendorId,
  defaultQty,
  defaultRate,
}: {
  vendors: VendorOpt[]
  items: CatalogItem[]
  defaultPrId?: string
  defaultRfqId?: string
  defaultVendorId?: string
  defaultQty?: string
  defaultRate?: string
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [vendorId, setVendorId] = React.useState(
    defaultVendorId && vendors.some((vendor) => vendor.id === defaultVendorId)
      ? defaultVendorId
      : (vendors[0]?.id ?? "")
  )
  const [itemId, setItemId] = React.useState(items[0]?.id ?? "")
  const selected = items.find((item) => item.id === itemId)
  const [qty, setQty] = React.useState(defaultQty ?? "100")
  const [rate, setRate] = React.useState(defaultRate ?? String(selected?.standard_cost ?? 9500))
  const preview = Number(qty) * Number(rate) * 1.18

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const formData = new FormData(event.currentTarget)
    formData.set("vendor_id", vendorId)
    formData.set("item_id", itemId)
    const result = await createPurchaseOrder(formData)
    setPending(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    router.push(`/dashboard/p2p/po/${result.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border p-4 md:grid-cols-2">
      {defaultPrId ? <input type="hidden" name="pr_id" value={defaultPrId} /> : null}
      {defaultRfqId ? <input type="hidden" name="rfq_id" value={defaultRfqId} /> : null}
      <div className="space-y-2 md:col-span-2">
        <Label>Vendor</Label>
        <Select value={vendorId} onValueChange={(value) => value && setVendorId(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Active vendor" />
          </SelectTrigger>
          <SelectContent>
            {vendors.map((vendor) => (
              <SelectItem key={vendor.id} value={vendor.id}>
                {vendor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Item</Label>
        <Select value={itemId} onValueChange={(value) => value && setItemId(value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.sku} · {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="po-desc">Item description</Label>
        <Input id="po-desc" name="description" defaultValue={selected?.name} required disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="quantity">Quantity</Label>
        <Input id="quantity" name="quantity" value={qty} onChange={(event) => setQty(event.target.value)} required disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rate">Rate (₹)</Label>
        <Input id="rate" name="rate" value={rate} onChange={(event) => setRate(event.target.value)} required disabled={pending} />
      </div>
      <input type="hidden" name="tax_rate" value="18" />
      <div className="space-y-2">
        <Label htmlFor="delivery_date">Delivery date</Label>
        <Input id="delivery_date" name="delivery_date" type="date" disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="payment_terms">Payment terms</Label>
        <Input id="payment_terms" name="payment_terms" defaultValue="Net 30" disabled={pending} />
      </div>
      <p className="text-sm text-muted-foreground md:col-span-2">
        Estimated total incl. 18% GST: {formatINR(Number.isFinite(preview) ? preview : 0)}. Approver:{" "}
        {poApproverLabel(Number.isFinite(preview) ? preview : 0)}.
      </p>
      {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
      <div className="flex justify-end md:col-span-2">
        <Button type="submit" disabled={pending || !vendorId}>Create PO</Button>
      </div>
    </form>
  )
}

export function GrnForm({ pos }: { pos: PoOpt[] }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const released = pos.filter((po) => po.status === "released" || po.status === "approved")
  const [poId, setPoId] = React.useState(released[0]?.id ?? "")
  const po = released.find((row) => row.id === poId)
  const [lineId, setLineId] = React.useState(po?.lines[0]?.id ?? "")

  React.useEffect(() => {
    setLineId(po?.lines[0]?.id ?? "")
  }, [poId, po])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const formData = new FormData(event.currentTarget)
    formData.set("po_id", poId)
    formData.set("po_line_id", lineId)
    const result = await createGoodsReceipt(formData)
    setPending(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    router.push("/dashboard/p2p/grn")
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border p-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label>Released PO</Label>
        <Select value={poId} onValueChange={(value) => value && setPoId(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select PO" />
          </SelectTrigger>
          <SelectContent>
            {released.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {row.po_number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>PO line</Label>
        <Select value={lineId} onValueChange={(value) => value && setLineId(value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(po?.lines ?? []).map((line) => (
              <SelectItem key={line.id} value={line.id}>
                {line.description} · ordered {line.quantity}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="received_qty">Received quantity</Label>
        <Input id="received_qty" name="received_qty" type="number" min={0} defaultValue={95} required disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rejected_qty">Rejected quantity</Label>
        <Input id="rejected_qty" name="rejected_qty" type="number" min={0} defaultValue={5} disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="warehouse">Warehouse</Label>
        <Input id="warehouse" name="warehouse" defaultValue="Main warehouse" disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="receipt_date">Receipt date</Label>
        <Input id="receipt_date" name="receipt_date" type="date" disabled={pending} />
      </div>
      {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
      <div className="flex justify-end md:col-span-2">
        <Button type="submit" disabled={pending || !poId}>Create GRN</Button>
      </div>
    </form>
  )
}

export function SesForm({ pos }: { pos: PoOpt[] }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [poId, setPoId] = React.useState(pos[0]?.id ?? "")

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const formData = new FormData(event.currentTarget)
    formData.set("po_id", poId)
    const result = await createServiceEntry(formData)
    setPending(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    router.push("/dashboard/p2p/ses")
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border p-4">
      <div className="space-y-2">
        <Label>PO</Label>
        <Select value={poId} onValueChange={(value) => value && setPoId(value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pos.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {row.po_number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Service performed</Label>
        <Input id="description" name="description" required placeholder="October IT support" disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">Amount (₹)</Label>
        <Input id="amount" name="amount" type="number" min={1} defaultValue={100000} required disabled={pending} />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending || !poId}>Record service performed</Button>
    </form>
  )
}

export function MatchRunForm({
  bills,
}: {
  bills: { id: string; bill_number: string; match_status: string; total_amount: number }[]
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const pendingBills = bills.filter((bill) => bill.match_status === "pending")
  const [billId, setBillId] = React.useState(pendingBills[0]?.id ?? "")

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await runThreeWayMatch(billId)
    setPending(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  if (pendingBills.length === 0) {
    return <p className="text-sm text-muted-foreground">No invoices waiting for three-way match.</p>
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        <Label>Vendor invoice</Label>
        <Select value={billId} onValueChange={(value) => value && setBillId(value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pendingBills.map((bill) => (
              <SelectItem key={bill.id} value={bill.id}>
                {bill.bill_number} · {formatINR(bill.total_amount)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending || !billId}>
        Run 3-way match
      </Button>
    </form>
  )
}

export function PaymentProposalForm({
  bills,
}: {
  bills: BillOpt[]
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [billId, setBillId] = React.useState(bills[0]?.id ?? "")

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const formData = new FormData(event.currentTarget)
    formData.set("bill_id", billId)
    const result = await createPaymentProposal(formData)
    setPending(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  if (bills.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No payable invoices. Approve the bill, clear match exceptions, and take the invoice off hold first.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_auto] md:items-end">
      <div className="space-y-2">
        <Label>Due invoice</Label>
        <Select value={billId} onValueChange={(value) => value && setBillId(value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {bills.map((bill) => (
              <SelectItem key={bill.id} value={bill.id}>
                {bill.bill_number} · {formatINR(bill.balance_due)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending || !billId}>
        Create payment proposal
      </Button>
      {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
    </form>
  )
}
