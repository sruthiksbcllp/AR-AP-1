"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { createRfq } from "@/app/dashboard/rfq/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatINR } from "@/lib/currency"
import type { RfqListItem } from "@/types/rfq"

export function RfqBoard({
  rfqs,
  error,
  initialTitle = "",
  prId,
}: {
  rfqs: RfqListItem[]
  error?: string | null
  initialTitle?: string
  prId?: string
}) {
  const router = useRouter()
  const [title, setTitle] = React.useState(initialTitle)
  const [pending, setPending] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setFormError(null)
    const formData = new FormData()
    formData.set("title", title)
    if (prId) formData.set("pr_id", prId)
    const result = await createRfq(formData)
    setPending(false)
    if (!result.success) {
      setFormError(result.error)
      return
    }
    router.push(`/dashboard/rfq/${result.id}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(event) => void onCreate(event)}
        className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-[1fr_auto] md:items-end"
      >
        <div className="space-y-2">
          <Label htmlFor="rfq-title">What do you need quotes for?</Label>
          <Input
            id="rfq-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Office laptops, annual audit, glass installation"
            required
            minLength={3}
            maxLength={160}
            disabled={pending}
          />
        </div>
        <Button type="submit" disabled={pending || title.trim().length < 3}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Create RFQ
        </Button>
        {formError ? (
          <p className="text-sm text-destructive md:col-span-2">{formError}</p>
        ) : (
          <p className="text-xs text-muted-foreground md:col-span-2">
            Procurement → RFQ creation → vendor responses → commercial evaluation.
            After the lowest quote is selected, create a purchase order.
          </p>
        )}
      </form>

      {error ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {error}
        </p>
      ) : null}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Quotes</TableHead>
              <TableHead className="text-right">Lowest (₹)</TableHead>
              <TableHead>Outcome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rfqs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No quotation requests yet.
                </TableCell>
              </TableRow>
            ) : (
              rfqs.map((rfq) => (
                <TableRow key={rfq.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/rfq/${rfq.id}`}
                      className="font-medium hover:underline"
                    >
                      {rfq.title}
                    </Link>
                  </TableCell>
                  <TableCell>{rfq.quoteCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {rfq.lowestAmount == null ? "—" : formatINR(rfq.lowestAmount)}
                  </TableCell>
                  <TableCell>
                    {rfq.status === "evaluated" && rfq.selectedVendorName ? (
                      <span className="text-sm">
                        {rfq.selectedVendorName}
                        {rfq.selectedAmount != null
                          ? ` · ${formatINR(rfq.selectedAmount)}`
                          : ""}
                        <Badge variant="secondary" className="ml-2">
                          Selected
                        </Badge>
                      </span>
                    ) : (
                      <Badge variant="outline">Collecting quotes</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
