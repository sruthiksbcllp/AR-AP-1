"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { decideBillApproval } from "@/app/dashboard/ap/actions"
import { BillStatusBadge } from "@/components/ap/bill-status-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatINR } from "@/lib/currency"
import { roleLabel } from "@/lib/auth/roles"
import type { BillListItem } from "@/types/bills"

type ApprovalDecisionDialogProps = {
  bill: BillListItem
  decision: "approved" | "rejected"
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ApprovalDecisionDialog({
  bill,
  decision,
  open,
  onOpenChange,
}: ApprovalDecisionDialogProps) {
  const router = useRouter()
  const [comments, setComments] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setComments("")
      setError(null)
    }
  }, [open])

  async function onConfirm() {
    setPending(true)
    setError(null)

    const result = await decideBillApproval({
      bill_id: bill.id,
      decision,
      comments,
    })

    setPending(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    onOpenChange(false)
    router.refresh()
  }

  const title = decision === "approved" ? "Approve bill" : "Reject bill"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Feedback comments are required and will be stored in approval logs
            for {bill.bill_number}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Vendor</span>
              <span className="font-medium">{bill.vendor?.name ?? "—"}</span>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-muted-foreground">Amount</span>
              <span className="tabular-nums">{formatINR(bill.total_amount)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`comments-${bill.id}-${decision}`}>
              Feedback comments
            </Label>
            <Textarea
              id={`comments-${bill.id}-${decision}`}
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              placeholder={
                decision === "approved"
                  ? "Why is this bill approved?"
                  : "Why is this bill rejected?"
              }
              required
              disabled={pending}
              className="min-h-24"
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={decision === "rejected" ? "destructive" : "default"}
            disabled={pending || !comments.trim()}
            onClick={() => void onConfirm()}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            {decision === "approved" ? "Confirm approve" : "Confirm reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type ApprovalsPanelProps = {
  bills: BillListItem[]
  canApprove: boolean
  role: string | null
  error?: string | null
}

export function ApprovalsPanel({
  bills,
  canApprove,
  role,
  error,
}: ApprovalsPanelProps) {
  const [active, setActive] = React.useState<{
    bill: BillListItem
    decision: "approved" | "rejected"
  } | null>(null)

  if (!canApprove) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
        <p className="text-sm font-medium">Approvals restricted</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Only a <span className="font-medium">Manager</span> (up to ₹50,000)
          or <span className="font-medium">Director / CFO</span> can review
          pending bills.
          {role ? ` Your role: ${roleLabel(role)}.` : ""}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        Pending vendor bills. Managers can approve up to ₹50,000. Larger bills
        need Director / CFO.
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      {bills.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          No bills awaiting approval.
        </div>
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => (
            <div
              key={bill.id}
              className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{bill.bill_number}</p>
                  <BillStatusBadge status={bill.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {bill.vendor?.name ?? "Unknown vendor"}
                  {bill.attachment_name
                    ? ` · Attachment: ${bill.attachment_name}`
                    : ""}
                </p>
                <p className="text-sm">
                  Due {bill.due_date} ·{" "}
                  <span className="font-medium tabular-nums">
                    {formatINR(bill.total_amount)}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    setActive({ bill, decision: "rejected" })
                  }
                >
                  Reject
                </Button>
                <Button
                  onClick={() => setActive({ bill, decision: "approved" })}
                >
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {active ? (
        <ApprovalDecisionDialog
          bill={active.bill}
          decision={active.decision}
          open={Boolean(active)}
          onOpenChange={(open) => {
            if (!open) setActive(null)
          }}
        />
      ) : null}
    </div>
  )
}
