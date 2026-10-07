"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { saveCatalogItem } from "@/app/dashboard/p2p/actions"
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
import type { CatalogItem } from "@/types/p2p"

export function CatalogTable({
  items,
  error,
  canWrite,
}: {
  items: CatalogItem[]
  error?: string | null
  canWrite: boolean
}) {
  const [q, setQ] = React.useState("")
  const [category, setCategory] = React.useState("all")
  const [kind, setKind] = React.useState("all")
  const categories = ["all", ...new Set(items.map((item) => item.category))]

  const filtered = items.filter((item) => {
    const hay = `${item.sku} ${item.name} ${item.description ?? ""}`.toLowerCase()
    if (q && !hay.includes(q.toLowerCase())) return false
    if (category !== "all" && item.category !== category) return false
    if (kind !== "all" && item.item_kind !== kind) return false
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="item-search">Search</Label>
            <Input
              id="item-search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="SKU, name, laptop…"
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(value) => value && setCategory(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item === "all" ? "All categories" : item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(value) => value && setKind(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Goods and services</SelectItem>
                <SelectItem value="goods">Goods</SelectItem>
                <SelectItem value="service">Services</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {canWrite ? (
          <Button asChild>
            <Link href="/dashboard/p2p/items/new">Add item</Link>
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">{error}</p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {filtered.length} of {items.length} items
      </p>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead className="text-right">Standard cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No items match this search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/dashboard/p2p/items/${item.id}`} className="hover:underline">
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.item_kind}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(item.standard_cost)}
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

export function CatalogForm({ item }: { item?: CatalogItem }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [kind, setKind] = React.useState(item?.item_kind ?? "goods")
  const [category, setCategory] = React.useState(item?.category ?? "laptop")

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const formData = new FormData(event.currentTarget)
    formData.set("item_kind", kind)
    formData.set("category", category)
    const result = await saveCatalogItem(formData)
    setPending(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    router.push(`/dashboard/p2p/items/${result.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border p-4 md:grid-cols-2">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <div className="space-y-2">
        <Label htmlFor="sku">SKU</Label>
        <Input id="sku" name="sku" required defaultValue={item?.sku} disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required defaultValue={item?.name} disabled={pending} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          defaultValue={item?.description ?? ""}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={category} onValueChange={(value) => value && setCategory(value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["laptop", "printer", "software", "it_support", "general"].map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Kind</Label>
        <Select value={kind} onValueChange={(value) => value && setKind(value as "goods" | "service")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="goods">Goods</SelectItem>
            <SelectItem value="service">Service</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="unit">Unit</Label>
        <Input id="unit" name="unit" defaultValue={item?.unit ?? "each"} disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="standard_cost">Standard cost (₹)</Label>
        <Input
          id="standard_cost"
          name="standard_cost"
          type="number"
          min={0}
          step="0.01"
          defaultValue={item?.standard_cost ?? 0}
          disabled={pending}
        />
      </div>
      {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
      <div className="flex justify-end gap-2 md:col-span-2">
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/p2p/items">Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {item ? "Save item" : "Add item"}
        </Button>
      </div>
    </form>
  )
}
