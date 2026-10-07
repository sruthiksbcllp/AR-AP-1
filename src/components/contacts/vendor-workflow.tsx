import { VENDOR_WORKFLOW_STEPS, vendorWorkflowCurrentStep } from "@/types/contacts"
import type { VendorStatus } from "@/types/contacts"

export function VendorWorkflow({
  status,
}: {
  status: VendorStatus | null
}) {
  const current = vendorWorkflowCurrentStep(status)
  const rejected = status === "rejected"

  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {VENDOR_WORKFLOW_STEPS.map((item) => {
        const reached = !rejected && item.step <= current
        const active = !rejected && item.step === current
        return (
          <li
            key={item.key}
            className={
              active
                ? "rounded-lg border bg-muted/40 px-3 py-3"
                : reached
                  ? "rounded-lg border px-3 py-3"
                  : "rounded-lg border border-dashed px-3 py-3 text-muted-foreground"
            }
          >
            <p className="text-xs font-medium text-muted-foreground">{item.step}</p>
            <p className="text-sm font-medium">{item.label}</p>
          </li>
        )
      })}
    </ol>
  )
}
