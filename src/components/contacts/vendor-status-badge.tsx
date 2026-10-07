"use client"

import { Badge } from "@/components/ui/badge"
import {
  VENDOR_STATUS_LABELS,
  type VendorStatus,
} from "@/types/contacts"

const VARIANTS: Record<
  VendorStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  procurement_review: "default",
  finance_review: "default",
  compliance_check: "default",
  active: "secondary",
  rejected: "destructive",
}

export function VendorStatusBadge({
  status,
}: {
  status: VendorStatus | null
}) {
  if (!status) return <span className="text-muted-foreground">—</span>
  return <Badge variant={VARIANTS[status]}>{VENDOR_STATUS_LABELS[status]}</Badge>
}
