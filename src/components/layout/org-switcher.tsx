"use client"

import { Building2, Check, ChevronsUpDown } from "lucide-react"
import { useRouter } from "next/navigation"

import { selectCompany } from "@/app/select-company/actions"
import { AppLogo } from "@/components/brand/app-logo"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CompanyMembership } from "@/lib/auth/company"
import { ROLE_LABELS, isUserRole } from "@/lib/auth/roles"

export function OrgSwitcher({
  companies,
  activeId,
  activeName,
}: {
  companies: CompanyMembership[]
  activeId: string
  activeName: string
}) {
  const router = useRouter()
  const active = companies.find((company) => company.id === activeId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-9 max-w-[240px] justify-between gap-2 px-2.5 font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <AppLogo size={24} className="size-6 shrink-0" />
            <span className="truncate text-sm font-medium">{activeName}</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Select your company</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            className="justify-between"
            onClick={() => {
              const formData = new FormData()
              formData.set("org_id", company.id)
              void selectCompany(formData)
            }}
          >
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{company.name}</span>
              <span className="text-xs text-muted-foreground">
                {isUserRole(company.role) ? ROLE_LABELS[company.role] : company.role}
              </span>
            </span>
            {active?.id === company.id ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/select-company")}>
          <Building2 className="size-4" />
          All companies
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
