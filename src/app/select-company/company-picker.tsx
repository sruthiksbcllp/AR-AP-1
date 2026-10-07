"use client"

import * as React from "react"
import { useActionState } from "react"
import { Building2, Loader2 } from "lucide-react"

import {
  createCompany,
  selectCompany,
  type CompanyActionState,
} from "@/app/select-company/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ROLE_LABELS, isUserRole } from "@/lib/auth/roles"
import type { CompanyMembership } from "@/lib/auth/company"

const initialState: CompanyActionState | null = null

export function CreateCompanyForm() {
  const [state, formAction, pending] = useActionState(createCompany, initialState)
  return (
    <form action={formAction} className="space-y-3 rounded-xl border p-4">
      <div>
        <h2 className="text-sm font-semibold">Create a company</h2>
        <p className="text-xs text-muted-foreground">
          Tag users in the Admin Portal so every role shares this company&apos;s data.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="company-name">Company name</Label>
        <Input
          id="company-name"
          name="name"
          required
          minLength={2}
          placeholder="SBC LLP"
          disabled={pending}
        />
      </div>
      {state && !state.success ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Create company
      </Button>
    </form>
  )
}

export function CompanyPicker({
  companies,
  canCreate,
  intendedRole,
}: {
  companies: CompanyMembership[]
  canCreate: boolean
  intendedRole: string
}) {
  return (
    <div className="space-y-6">
      {companies.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose the company whose data you will work with. Every role tagged to
            that company sees the same records, filtered to their role.
          </p>
          <ul className="space-y-2">
            {companies.map((company) => (
              <li key={company.id}>
                <form action={selectCompany}>
                  <input type="hidden" name="org_id" value={company.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    className="h-auto w-full justify-between px-4 py-3"
                  >
                    <span className="flex items-center gap-3 text-left">
                      <Building2 className="size-4 shrink-0 text-muted-foreground" />
                      <span>
                        <span className="block font-medium">{company.name}</span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          Your role:{" "}
                          {isUserRole(company.role)
                            ? ROLE_LABELS[company.role]
                            : company.role}
                        </span>
                      </span>
                    </span>
                    <span className="text-sm text-muted-foreground">Continue</span>
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-lg border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
          You are not tagged to a company yet
          {intendedRole ? ` (signed up as ${intendedRole})` : ""}. An admin must
          add you in the Admin Portal, or create a company if you are setting up
          the workspace.
        </p>
      )}

      {canCreate ? <CreateCompanyForm /> : null}
    </div>
  )
}
