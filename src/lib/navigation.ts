import {
  LayoutDashboard,
  HandCoins,
  Wallet,
  ClipboardCheck,
  Users,
  BookOpen,
  ScrollText,
  Scale,
  Building2,
  type LucideIcon,
} from "lucide-react"

import {
  canAccessModule,
  type AppModule,
  type UserRole,
} from "@/lib/auth/roles"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  module: AppModule
  description?: string
  /** Extra path prefixes that keep this item highlighted. */
  activePrefixes?: string[]
}

export const mainNavItems: NavItem[] = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    module: "overview",
    description: "Executive dashboard and KPIs",
  },
  {
    title: "Accounts Receivable (AR)",
    href: "/dashboard/ar",
    icon: HandCoins,
    module: "ar",
    description: "Invoices, collections, and aging",
  },
  {
    title: "Request for Quotation",
    href: "/dashboard/rfq",
    icon: Scale,
    module: "rfq",
    description: "Compare vendor quotes before a bill",
  },
  {
    title: "Accounts Payable",
    href: "/dashboard/p2p",
    icon: Wallet,
    module: "p2p",
    description: "Vendor invoices, matching, and payments",
    activePrefixes: ["/dashboard/p2p", "/dashboard/ap"],
  },
  {
    title: "Approvals",
    href: "/dashboard/approvals",
    icon: ClipboardCheck,
    module: "approvals",
    description: "Pending reviews and workflows",
  },
  {
    title: "Contacts (Vendors/Clients)",
    href: "/dashboard/contacts",
    icon: Users,
    module: "contacts",
    description: "Vendor onboarding and customer directory",
  },
  {
    title: "Accounting",
    href: "/dashboard/accounting",
    icon: BookOpen,
    module: "accounting",
    description: "Ledger, journals, and financial statements",
  },
  {
    title: "Audit Logs",
    href: "/dashboard/audit",
    icon: ScrollText,
    module: "audit",
    description: "System activity and compliance trail",
  },
  {
    title: "Admin Portal",
    href: "/dashboard/admin",
    icon: Building2,
    module: "admin",
    description: "Companies, members, and role tags",
  },
]

export function navItemsForRole(role: UserRole) {
  return mainNavItems.filter((item) => canAccessModule(role, item.module))
}
