"use client"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Notifications } from "@/components/layout/notifications"
import { OrgSwitcher } from "@/components/layout/org-switcher"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { UserNav } from "@/components/layout/user-nav"

export function AppHeader({
  displayName,
  roleLabel,
  companies,
  orgId,
  orgName,
}: {
  displayName?: string
  roleLabel?: string
  companies: { id: string; name: string; role: string }[]
  orgId: string
  orgName: string
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/70">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <OrgSwitcher companies={companies} activeId={orgId} activeName={orgName} />

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Notifications />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <UserNav displayName={displayName} roleLabel={roleLabel} />
      </div>
    </header>
  )
}
