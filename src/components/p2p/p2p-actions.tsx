"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  advanceMatchException,
  advancePaymentProposal,
  advanceServiceEntry,
  decidePurchaseOrder,
  decidePurchaseRequisition,
  toggleBillHold,
} from "@/app/dashboard/p2p/actions"
import { Button } from "@/components/ui/button"

function ActionButton({
  label,
  variant,
  run,
}: {
  label: string
  variant?: "default" | "destructive" | "outline" | "secondary"
  run: () => Promise<{ success: boolean; error?: string }>
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={variant}
        disabled={pending}
        onClick={() => {
          void (async () => {
            setPending(true)
            setError(null)
            const result = await run()
            setPending(false)
            if (!result.success) {
              setError(result.error ?? "Request failed.")
              return
            }
            router.refresh()
          })()
        }}
      >
        {label}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export function PrDecisionButtons({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton
        label="Reject"
        variant="destructive"
        run={() => decidePurchaseRequisition({ id, decision: "rejected" })}
      />
      <ActionButton
        label="Approve"
        run={() => decidePurchaseRequisition({ id, decision: "approved" })}
      />
    </div>
  )
}

export function PoDecisionButtons({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton
        label="Reject"
        variant="destructive"
        run={() => decidePurchaseOrder({ id, decision: "rejected" })}
      />
      <ActionButton
        label="Approve and release"
        run={() => decidePurchaseOrder({ id, decision: "approved" })}
      />
    </div>
  )
}

export function SesAdvanceButton({ id, status }: { id: string; status: string }) {
  const label =
    status === "performed"
      ? "Confirm service"
      : status === "confirmed"
        ? "Send to manager"
        : status === "manager_review"
          ? "Approve SES"
          : null
  if (!label) return null
  return <ActionButton label={label} run={() => advanceServiceEntry(id)} />
}

export function MatchAdvanceButton({ id, stage }: { id: string; stage: string | null }) {
  const label =
    stage === "procurement"
      ? "Procurement review complete"
      : stage === "finance"
        ? "Finance approve / waive"
        : null
  if (!label) return null
  return <ActionButton label={label} run={() => advanceMatchException(id)} />
}

export function PaymentAdvanceButton({ id, status }: { id: string; status: string }) {
  const label =
    status === "proposed"
      ? "Finance approval"
      : status === "finance_approved"
        ? "Record bank payment"
        : status === "paid"
          ? "Confirm payment"
          : null
  if (!label) return null
  return <ActionButton label={label} run={() => advancePaymentProposal(id)} />
}

export function BillHoldButton({ id, onHold }: { id: string; onHold: boolean }) {
  return (
    <ActionButton
      label={onHold ? "Release hold" : "Hold invoice"}
      variant="outline"
      run={() => toggleBillHold(id)}
    />
  )
}
