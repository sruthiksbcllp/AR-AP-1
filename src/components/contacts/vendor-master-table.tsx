"use client"

import Link from "next/link"

import { VendorStatusBadge } from "@/components/contacts/vendor-status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { VendorMaster } from "@/types/contacts"

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function VendorMasterTable({
  vendors,
  error,
}: {
  vendors: VendorMaster[]
  error?: string | null
}) {
  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor_Code</TableHead>
              <TableHead>Vendor_Name</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>PAN</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Payment_Terms</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created_By</TableHead>
              <TableHead>Created_Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.length ? (
              vendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-mono text-xs">
                    {vendor.vendor_code ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/contacts/vendors/${vendor.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {vendor.name}
                    </Link>
                  </TableCell>
                  <TableCell>{vendor.country ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {vendor.gstin ?? vendor.tax_id ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {vendor.pan ?? "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">{vendor.currency}</TableCell>
                  <TableCell>{vendor.payment_terms ?? "—"}</TableCell>
                  <TableCell>
                    <VendorStatusBadge status={vendor.vendor_status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {vendor.created_by_email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(vendor.created_at)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="h-24 text-center text-muted-foreground"
                >
                  No vendor master records yet. Submit a supplier before
                  procurement can start.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
