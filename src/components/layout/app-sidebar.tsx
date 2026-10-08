"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { AppLogo } from "@/components/brand/app-logo"
import { APP_NAME, APP_TAGLINE } from "@/lib/brand"
import { canAccessModule, type UserRole } from "@/lib/auth/roles"
import { mainNavItems } from "@/lib/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

export function AppSidebar({
  role,
  orgName,
}: {
  role: UserRole
  orgName?: string
}) {
  const pathname = usePathname()
  const items = mainNavItems.filter((item) => canAccessModule(role, item.module))

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={APP_NAME}>
              <Link href="/dashboard">
                <AppLogo size={32} className="size-8 shrink-0" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold tracking-tight">
                    {APP_NAME}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {orgName ?? APP_TAGLINE}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const prefixes = item.activePrefixes ?? [item.href]
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : prefixes.some(
                        (prefix) =>
                          pathname === prefix || pathname.startsWith(`${prefix}/`)
                      )

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span className="min-w-0 truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="pointer-events-none text-muted-foreground">
              <span className="truncate text-xs">v0.1.0 · Enterprise</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
