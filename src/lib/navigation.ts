import {
  LayoutDashboard,
  HandCoins,
  Wallet,
  ClipboardCheck,
  Users,
  BookOpen,
  ScrollText,
  Scale,
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
    title: "Accounts Payable (AP)",
    href: "/dashboard/ap",
    icon: Wallet,
    module: "ap",
    description: "Bills, payments, and vendor spend",
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
    description: "Vendors, clients, and directories",
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
]

export function navItemsForRole(role: UserRole) {
  return mainNavItems.filter((item) => canAccessModule(role, item.module))
}
