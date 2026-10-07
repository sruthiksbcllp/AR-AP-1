"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import {
  resubmitVendorOnboarding,
  reviewVendorOnboarding,
} from "@/app/dashboard/contacts/actions"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  canResubmitVendor,
  canReviewVendorStatus,
  type UserRole,
} from "@/lib/auth/roles"
import type { VendorStatus } from "@/types/contacts"

export function VendorReviewActions({
  vendorId,
  status,
  role,
}: {
  vendorId: string
  status: VendorStatus | null
  role: UserRole
}) {
  const router = useRouter()
  const [comments, setComments] = React.useState("")
  const [pending, setPending] = React.useState<"approve" | "reject" | "resubmit" | null>(
    null
  )
  const [error, setError] = React.useState<string | null>(null)

  const canReview = canReviewVendorStatus(role, status)
  const canResubmit = status === "rejected" && canResubmitVendor(role)

  if (!canReview && !canResubmit) return null

  async function onReview(decision: "approved" | "rejected") {
    setPending(decision === "approved" ? "approve" : "reject")
    setError(null)
    const result = await reviewVendorOnboarding({
      vendor_id: vendorId,
      decision,
      comments,
    })
    setPending(null)
    if (!result.success) {
      setError(result.error)
      return
    }
    setComments("")
    router.refresh()
  }

  async function onResubmit() {
    setPending("resubmit")
    setError(null)
    const result = await resubmitVendorOnboarding(vendorId)
    setPending(null)
    if (!result.success) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <h2 className="text-sm font-semibold">Review</h2>
      {canReview ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="vendor-review-comments">Comments</Label>
            <Textarea
              id="vendor-review-comments"
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              placeholder="Required when rejecting"
              disabled={pending !== null}
              className="min-h-20"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={pending !== null}
              onClick={() => void onReview("rejected")}
            >
              {pending === "reject" ? <Loader2 className="animate-spin" /> : null}
              Reject
            </Button>
            <Button
              type="button"
              disabled={pending !== null}
              onClick={() => void onReview("approved")}
            >
              {pending === "approve" ? <Loader2 className="animate-spin" /> : null}
              Approve and continue
            </Button>
          </div>
        </>
      ) : null}
      {canResubmit ? (
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={pending !== null}
            onClick={() => void onResubmit()}
          >
            {pending === "resubmit" ? <Loader2 className="animate-spin" /> : null}
            Resubmit for procurement review
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
