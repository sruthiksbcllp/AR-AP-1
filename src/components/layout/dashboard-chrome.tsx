import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { NO_COMPANY_SELECTED, requireOrgContext } from "@/lib/auth/org"
import {
  canAccessModule,
  homePathForRole,
  moduleFromPathname,
  roleLabel,
} from "@/lib/auth/roles"

export async function DashboardChrome({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = await requireOrgContext()
  if (!auth.ok) {
    redirect(auth.error === NO_COMPANY_SELECTED ? "/select-company" : "/login")
  }

  const { role, displayName, companies, orgId, orgName } = auth.ctx
  const pathname = (await headers()).get("x-pathname") ?? "/dashboard"
  const module = moduleFromPathname(pathname)
  if (module && !canAccessModule(role, module)) {
    redirect(homePathForRole(role))
  }

  return (
    <SidebarProvider>
      <AppSidebar role={role} orgName={orgName} />
      <SidebarInset>
        <AppHeader
          displayName={displayName}
          roleLabel={roleLabel(role)}
          companies={companies}
          orgId={orgId}
          orgName={orgName}
        />
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
