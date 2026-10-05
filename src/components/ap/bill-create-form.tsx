"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Trash2, Upload } from "lucide-react"

import { createBill } from "@/app/dashboard/ap/actions"
import { extractBillFromUpload } from "@/app/dashboard/ap/extract"
import { VendorCombobox } from "@/components/ap/vendor-combobox"
import { NewContactSheet } from "@/components/contacts/new-contact-sheet"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatINR, formatMoney } from "@/lib/currency"
import {
  BILL_APPROVAL_THRESHOLD,
  GST_TAX_RATES,
  calcLineTotal,
  calcTaxAmount,
  roundMoney,
} from "@/types/bills"

type VendorOption = {
  id: string
  name: string
  email: string | null
  currency: string
}

type LineItemDraft = {
  key: string
  description: string
  quantity: string
  unit_price: string
  tax_rate: string
}

type BillCreateFormProps = {
  vendors: VendorOption[]
  vendorsError?: string | null
  initialVendorId?: string
  initialDescription?: string
  initialAmount?: string
}

function createEmptyLine(): LineItemDraft {
  return {
    key: crypto.randomUUID(),
    description: "",
    quantity: "1",
    unit_price: "0",
    tax_rate: "18",
  }
}

function addDaysInputValue(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function suggestBillNumber() {
  const stamp = new Date()
  const y = stamp.getFullYear()
  const m = String(stamp.getMonth() + 1).padStart(2, "0")
  const d = String(stamp.getDate()).padStart(2, "0")
  const rand = String(Math.floor(Math.random() * 900) + 100)
  return `BILL-${y}${m}${d}-${rand}`
}

export function BillCreateForm({
  vendors,
  vendorsError,
  initialVendorId = "",
  initialDescription = "",
  initialAmount = "",
}: BillCreateFormProps) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [vendorOptions, setVendorOptions] = React.useState(vendors)
  const [vendorId, setVendorId] = React.useState(() =>
    vendors.some((vendor) => vendor.id === initialVendorId) ? initialVendorId : ""
  )
  const [billNumber, setBillNumber] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")
  const [attachment, setAttachment] = React.useState<File | null>(null)
  const [extracting, setExtracting] = React.useState(false)
  const [extractNote, setExtractNote] = React.useState<string | null>(null)
  const [extractFailed, setExtractFailed] = React.useState(false)
  const [needsReview, setNeedsReview] = React.useState(false)
  const [blockSubmit, setBlockSubmit] = React.useState(false)
  const [fxSummary, setFxSummary] = React.useState<{
    invoiceDate: string
    sourceCurrency: string
    sourceTotal: number
    fxRate: number
    inrTotal: number
  } | null>(null)
  const extractGen = React.useRef(0)
  const [lines, setLines] = React.useState<LineItemDraft[]>(() => {
    const amount = Number(initialAmount)
    if (!initialDescription) return [createEmptyLine()]
    return [
      {
        key: crypto.randomUUID(),
        description: initialDescription,
        quantity: "1",
        unit_price: Number.isFinite(amount) && amount > 0 ? String(amount) : "0",
        tax_rate: "0",
      },
    ]
  })

  React.useEffect(() => {
    setVendorOptions(vendors)
  }, [vendors])

  React.useEffect(() => {
    setBillNumber((current) => current || suggestBillNumber())
    setDueDate((current) => current || addDaysInputValue(30))
  }, [])

  const computedLines = lines.map((line) => {
    const quantity = Number(line.quantity) || 0
    const unitPrice = Number(line.unit_price) || 0
    const taxRate = Number(line.tax_rate) || 0
    const subtotal = roundMoney(quantity * unitPrice)
    const taxAmount = calcTaxAmount(quantity, unitPrice, taxRate)
    const lineTotal = calcLineTotal(quantity, unitPrice, taxRate)
    return {
      ...line,
      quantity,
      unitPrice,
      taxRate,
      subtotal,
      taxAmount,
      lineTotal,
    }
  })

  const subtotal = roundMoney(
    computedLines.reduce((sum, line) => sum + line.subtotal, 0)
  )
  const taxTotal = roundMoney(
    computedLines.reduce((sum, line) => sum + line.taxAmount, 0)
  )
  const grandTotal = roundMoney(subtotal + taxTotal)
  const requiresApproval = grandTotal > BILL_APPROVAL_THRESHOLD
  const busy = pending || extracting

  function updateLine(key: string, patch: Partial<LineItemDraft>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    )
  }

  function removeLine(key: string) {
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((line) => line.key !== key)
    )
  }

  async function onAttachmentChange(file: File | null) {
    const gen = ++extractGen.current
    setAttachment(file)
    setExtractNote(null)
    setExtractFailed(false)
    setNeedsReview(false)
    setBlockSubmit(false)
    setFxSummary(null)
    if (!file) return

    setExtracting(true)
    try {
      const formData = new FormData()
      formData.set("attachment", file)
      const result = await extractBillFromUpload(formData)
      if (gen !== extractGen.current) return

      if (!result.success) {
        setExtractFailed(true)
        setExtractNote(result.error)
        return
      }

      setNeedsReview(result.needsReview)
      setBlockSubmit(result.blockSubmit)
      if (
        result.invoiceDate &&
        result.fxRate &&
        result.sourceTotal != null &&
        result.inrTotal != null
      ) {
        setFxSummary({
          invoiceDate: result.invoiceDate,
          sourceCurrency: result.sourceCurrency,
          sourceTotal: result.sourceTotal,
          fxRate: result.fxRate,
          inrTotal: result.inrTotal,
        })
      }

      if (result.newVendor) {
        const createdVendor = result.newVendor
        setVendorOptions((prev) => {
          if (prev.some((vendor) => vendor.id === createdVendor.id)) {
            return prev
          }
          return [...prev, createdVendor].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        })
      }
      if (result.vendorId) setVendorId(result.vendorId)
      if (result.billNumber) setBillNumber(result.billNumber)
      if (result.dueDate) setDueDate(result.dueDate)
      if (result.items.length > 0) {
        setLines(
          result.items.map((item) => ({
            key: crypto.randomUUID(),
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
          }))
        )
      }
      setExtractNote(result.message)
    } catch {
      if (gen !== extractGen.current) return
      setExtractFailed(true)
      setExtractNote(
        "Could not read this bill automatically. The file is still attached — fill vendor, dates, and items by hand."
      )
    } finally {
      if (gen === extractGen.current) setExtracting(false)
    }
  }

  async function submit(saveAsDraft: boolean) {
    setPending(true)
    setError(null)

    const formData = new FormData()
    formData.set("vendor_id", vendorId)
    formData.set("bill_number", billNumber.trim())
    formData.set("due_date", dueDate)
    formData.set("save_as_draft", String(saveAsDraft))
    formData.set(
      "items",
      JSON.stringify(
        computedLines.map((line) => ({
          description: line.description.trim(),
          quantity: line.quantity,
          unit_price: line.unitPrice,
          tax_rate: line.taxRate,
          line_total: line.lineTotal,
        }))
      )
    )
    if (attachment) {
      formData.set("attachment", attachment)
    }

    const result = await createBill(formData)
    setPending(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    router.push("/dashboard/ap")
    router.refresh()
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        void submit(false)
      }}
    >
      {vendorsError ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {vendorsError}
        </div>
      ) : null}

      <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        Bills totaling more than {formatINR(BILL_APPROVAL_THRESHOLD)} are sent
        for approval. Managers can approve up to ₹50,000; larger amounts need
        Director / CFO.
      </div>
      {initialDescription ? (
        <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
          Started from the selected quotation. The line is the quoted amount
          with no GST. Add tax if the vendor bill includes it.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2 md:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="vendor_id">Vendor</Label>
            <NewContactSheet
              defaultType="vendor"
              lockType
              onCreated={(contact) => {
                if (contact.type !== "vendor") return
                setVendorOptions((prev) => {
                  if (prev.some((vendor) => vendor.id === contact.id)) {
                    return prev
                  }
                  return [
                    ...prev,
                    {
                      id: contact.id,
                      name: contact.name,
                      email: contact.email,
                      currency: contact.currency,
                    },
                  ].sort((a, b) => a.name.localeCompare(b.name))
                })
                setVendorId(contact.id)
              }}
              trigger={
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2">
                  <Plus />
                  Add vendor
                </Button>
              }
            />
          </div>
          <VendorCombobox
            vendors={vendorOptions}
            value={vendorId}
            onChange={setVendorId}
            disabled={busy}
          />
          {vendorOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No vendors yet. Click <span className="font-medium">Add vendor</span>{" "}
              and enter the vendor name, or add one under{" "}
              <Link
                href="/dashboard/contacts"
                className="underline underline-offset-2"
              >
                Contacts
              </Link>
              .
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Type to search an existing vendor, or add a new name with Add
              vendor.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="bill_number">Bill number</Label>
          <Input
            id="bill_number"
            value={billNumber}
            onChange={(event) => setBillNumber(event.target.value)}
            required
            disabled={busy}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_date">Due date</Label>
          <Input
            id="due_date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            required
            disabled={busy}
          />
        </div>

        <div className="space-y-2 md:col-span-2 xl:col-span-3">
          <Label htmlFor="attachment">Vendor invoice upload</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="attachment"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*"
              disabled={busy}
              onChange={(event) =>
                void onAttachmentChange(event.target.files?.[0] ?? null)
              }
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Upload className="size-3.5" />
              Reads the invoice date and converts USD at that day's USD-to-INR rate · max 10MB
            </div>
          </div>
          {extracting ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Reading vendor, invoice date, due date, items, and total…
            </p>
          ) : extractNote ? (
            <p
              className={
                extractFailed || needsReview
                  ? "text-sm text-amber-800 dark:text-amber-200"
                  : "text-sm text-muted-foreground"
              }
            >
              {extractNote}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Upload a PDF or photo. The form fills from the invoice and converts foreign
              amounts using the invoice-date rate — review it before submitting.
              Word files attach only.
            </p>
          )}
          {fxSummary ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm tabular-nums">
              {formatMoney(fxSummary.sourceTotal, fxSummary.sourceCurrency)} ×{" "}
              {formatINR(fxSummary.fxRate)} per {fxSummary.sourceCurrency} on{" "}
              {fxSummary.invoiceDate} = {formatINR(fxSummary.inrTotal)}
            </p>
          ) : null}
          {attachment && !extracting ? (
            <p className="text-xs text-muted-foreground">
              Selected: {attachment.name}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Line items</h2>
            <p className="text-xs text-muted-foreground">
              Quantity × unit rate, plus GST, rolls into the row total.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setLines((prev) => [...prev, createEmptyLine()])}
          >
            <Plus />
            Add line
          </Button>
        </div>

        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">Item</TableHead>
                <TableHead className="w-28">Qty</TableHead>
                <TableHead className="w-36">Unit rate (₹)</TableHead>
                <TableHead className="w-32">Tax</TableHead>
                <TableHead className="w-36 text-right">Row total</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {computedLines.map((line) => (
                <TableRow key={line.key}>
                  <TableCell>
                    <Input
                      value={line.description}
                      onChange={(event) =>
                        updateLine(line.key, {
                          description: event.target.value,
                        })
                      }
                      placeholder="Goods / services"
                      required
                      disabled={busy}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0.0001"
                      step="any"
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.key, { quantity: event.target.value })
                      }
                      required
                      disabled={busy}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.unit_price}
                      onChange={(event) =>
                        updateLine(line.key, {
                          unit_price: event.target.value,
                        })
                      }
                      required
                      disabled={busy}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={line.tax_rate}
                      onValueChange={(value) => {
                        if (value) updateLine(line.key, { tax_rate: value })
                      }}
                      disabled={busy}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GST_TAX_RATES.map((rate) => (
                          <SelectItem key={rate} value={String(rate)}>
                            {rate}% GST
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatINR(line.lineTotal)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy || lines.length === 1}
                      onClick={() => removeLine(line.key)}
                      aria-label="Remove line"
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="ml-auto w-full max-w-sm space-y-2 rounded-xl border bg-muted/20 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatINR(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tax</span>
          <span className="tabular-nums">{formatINR(taxTotal)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-semibold">
          <span>Grand total</span>
          <span className="tabular-nums">{formatINR(grandTotal)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          On submit:{" "}
          {requiresApproval
            ? "status → pending_approval"
            : "status → approved (auto)"}
        </p>
      </div>

      {needsReview && !blockSubmit ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          Review required: the invoice date or historical USD-to-INR rate could
          not be confirmed, so amounts were not converted. Check the filled values
          before submitting.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" asChild disabled={busy}>
          <Link href="/dashboard/ap">Cancel</Link>
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || blockSubmit || !vendorId}
          onClick={() => void submit(true)}
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save draft
        </Button>
        <Button type="submit" disabled={busy || blockSubmit || !vendorId}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" />
              Submitting…
            </>
          ) : (
            "Submit bill"
          )}
        </Button>
      </div>
    </form>
  )
}
