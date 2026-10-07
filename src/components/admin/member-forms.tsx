"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { addCompanyMember, removeCompanyMember } from "@/app/dashboard/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ROLE_LABELS, USER_ROLES } from "@/lib/auth/roles"

export function AddMemberForm({ orgId }: { orgId: string }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await addCompanyMember(new FormData(event.currentTarget))
    setPending(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    event.currentTarget.reset()
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_12rem_auto] md:items-end">
      <input type="hidden" name="org_id" value={orgId} />
      <div className="space-y-2">
        <Label htmlFor="member-email">Work email</Label>
        <Input
          id="member-email"
          name="email"
          type="email"
          required
          placeholder="finance@company.com"
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="member-role">Role</Label>
        <select
          id="member-role"
          name="role"
          required
          disabled={pending}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          defaultValue="requester"
        >
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Tag to company
      </Button>
      {error ? <p className="text-sm text-destructive md:col-span-3">{error}</p> : null}
    </form>
  )
}

export function RemoveMemberButton({
  orgId,
  userId,
}: {
  orgId: string
  userId: string
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          void (async () => {
            setPending(true)
            setError(null)
            const formData = new FormData()
            formData.set("org_id", orgId)
            formData.set("user_id", userId)
            const result = await removeCompanyMember(formData)
            setPending(false)
            if (!result.success) {
              setError(result.error)
              return
            }
            router.refresh()
          })()
        }}
      >
        Remove
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
