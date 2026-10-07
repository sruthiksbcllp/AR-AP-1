"use client"

import type { LegacyColumnDef } from "@tanstack/react-table/legacy"
import { Paperclip } from "lucide-react"

import { BillStatusBadge } from "@/components/ap/bill-status-badge"
import { formatINR } from "@/lib/currency"
import type { BillListItem } from "@/types/bills"

export const billColumns: LegacyColumnDef<BillListItem>[] = [
  {
    accessorKey: "bill_number",
    header: "Bill #",
    cell: ({ row }) => (
      <div className="flex items-center gap-2 font-medium">
        <span>{row.original.bill_number}</span>
        {row.original.attachment_path ? (
          <Paperclip className="size-3.5 text-muted-foreground" />
        ) : null}
      </div>
    ),
  },
  {
    id: "vendor",
    accessorFn: (row) => row.vendor?.name ?? "",
    header: "Vendor",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.vendor?.name ?? "—"}</div>
        <div className="text-xs text-muted-foreground">
          {row.original.vendor?.email ?? ""}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "due_date",
    header: "Due date",
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.due_date}
      </span>
    ),
  },
  {
    id: "po",
    accessorFn: (row) => row.po_number ?? "",
    header: "PO",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.po_number ?? "—"}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    filterFn: (row, id, value) => {
      if (!value || value === "all") return true
      return row.getValue(id) === value
    },
    cell: ({ row }) => <BillStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "total_amount",
    header: "Total",
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {formatINR(row.original.total_amount)}
      </span>
    ),
  },
  {
    accessorKey: "balance_due",
    header: "Balance due",
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {formatINR(row.original.balance_due)}
      </span>
    ),
  },
  {
    id: "match",
    accessorFn: (row) => row.match_status,
    header: "Match",
    cell: ({ row }) => (
      <span className="text-xs uppercase text-muted-foreground">
        {row.original.on_hold ? "HOLD · " : ""}
        {row.original.match_status.replaceAll("_", " ")}
      </span>
    ),
  },
  {
    accessorKey: "attachment_name",
    header: "Attachment",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.attachment_name ?? "—"}
      </span>
    ),
  },
]
