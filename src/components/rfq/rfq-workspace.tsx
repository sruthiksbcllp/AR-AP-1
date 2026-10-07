"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { addRfqQuote, selectLowestQuote } from "@/app/dashboard/rfq/actions"
import { Badge } from "@/components/ui/badge"
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
import { formatINR } from "@/lib/currency"
import type { RfqDetail } from "@/types/rfq"

type VendorOption = {
  id: string
  name: string
  email: string | null
}

const STEPS = [
  "Procurement",
  "RFQ creation",
  "Vendor responses",
  "Commercial evaluation",
] as const

export function RfqWorkspace({
  rfq,
  vendors,
  vendorsError,
}: {
  rfq: RfqDetail
  vendors: VendorOption[]
  vendorsError?: string | null
}) {
  const router = useRouter()
  const [vendorId, setVendorId] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [pending, setPending] = React.useState<"quote" | "select" | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const quotedVendorIds = new Set(rfq.quotes.map((quote) => quote.vendorId))
  const availableVendors = vendors.filter((vendor) => !quotedVendorIds.has(vendor.id))
  const lowest = rfq.quotes[0]?.amount ?? null
  const selected = rfq.quotes.find((quote) => quote.id === rfq.selectedQuoteId) ?? null
  const step =
    rfq.status === "evaluated" ? 4 : rfq.quotes.length > 0 ? 3 : 2

  async function onAddQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending("quote")
    setError(null)
    const formData = new FormData()
    formData.set("rfq_id", rfq.id)
    formData.set("vendor_id", vendorId)
    formData.set("amount", amount)
    const result = await addRfqQuote(formData)
    setPending(null)
    if (!result.success) {
      setError(result.error)
      return
    }
    setVendorId("")
    setAmount("")
    router.refresh()
  }

  async function onSelectLowest() {
    setPending("select")
    setError(null)
    const formData = new FormData()
    formData.set("rfq_id", rfq.id)
    const result = await selectLowestQuote(formData)
    setPending(null)
    if (!result.success) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  const billHref = selected
    ? `/dashboard/ap/new?vendor=${encodeURIComponent(selected.vendorId)}&memo=${encodeURIComponent(rfq.title)}&amount=${encodeURIComponent(String(selected.amount))}`
    : null
  const poHref = selected
    ? `/dashboard/p2p/po/new?rfq=${encodeURIComponent(rfq.id)}&vendor=${encodeURIComponent(selected.vendorId)}`
    : null

  return (
    <div className="flex flex-col gap-6">
      <ol className="grid gap-2 sm:grid-cols-4">
        {STEPS.map((label, index) => {
          const number = index + 1
          const reached = number <= step
          return (
            <li
              key={label}
              className={
                reached
                  ? "rounded-lg border bg-muted/40 px-3 py-3"
                  : "rounded-lg border border-dashed px-3 py-3 text-muted-foreground"
              }
            >
              <p className="text-xs font-medium text-muted-foreground">{number}</p>
              <p className="text-sm font-medium">{label}</p>
            </li>
          )
        })}
      </ol>

      {rfq.status === "open" ? (
        <form
          onSubmit={(event) => void onAddQuote(event)}
          className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_12rem_auto] md:items-end"
        >
          <div className="space-y-2">
            <Label>Vendor</Label>
            <Select
              value={vendorId}
              onValueChange={(value) => {
                if (value) setVendorId(value)
              }}
              disabled={pending !== null || availableVendors.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {availableVendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                    {vendor.email ? ` · ${vendor.email}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-amount">Quoted amount (₹)</Label>
            <Input
              id="quote-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="95000"
              required
              disabled={pending !== null}
            />
          </div>
          <Button
            type="submit"
            disabled={pending !== null || !vendorId || Number(amount.replace(/,/g, "")) <= 0}
          >
            {pending === "quote" ? <Loader2 className="animate-spin" /> : null}
            Add quote
          </Button>
          {vendorsError ? (
            <p className="text-sm text-destructive md:col-span-3">{vendorsError}</p>
          ) : availableVendors.length === 0 ? (
            <p className="text-sm text-muted-foreground md:col-span-3">
              {vendors.length === 0
                ? "Onboard and create a vendor before recording a quote."
                : "Every vendor already has a quote on this request."}
            </p>
          ) : null}
        </form>
      ) : null}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Quoted amount (₹)</TableHead>
              <TableHead>Outcome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rfq.quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  No vendor responses yet.
                </TableCell>
              </TableRow>
            ) : (
              rfq.quotes.map((quote) => {
                const isLowest = quote.amount === lowest
                const isSelected = quote.id === rfq.selectedQuoteId
                return (
                  <TableRow key={quote.id} className={isSelected ? "bg-muted/40" : undefined}>
                    <TableCell className="font-medium">{quote.vendorName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatINR(quote.amount)}
                    </TableCell>
                    <TableCell>
                      {isSelected ? (
                        <Badge>Selected (lowest quote)</Badge>
                      ) : isLowest && rfq.status === "open" ? (
                        <span className="text-sm text-muted-foreground">Lowest so far</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/rfq">All requests</Link>
        </Button>
        {rfq.status === "open" ? (
          <Button
            type="button"
            disabled={pending !== null || rfq.quotes.length === 0}
            onClick={() => void onSelectLowest()}
          >
            {pending === "select" ? <Loader2 className="animate-spin" /> : null}
            Select lowest quote
          </Button>
        ) : (
          <>
            {poHref ? (
              <Button asChild>
                <Link href={poHref}>Create purchase order</Link>
              </Button>
            ) : null}
            {billHref ? (
              <Button variant="outline" asChild>
                <Link href={billHref}>Create vendor invoice</Link>
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
