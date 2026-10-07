"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "cn"

const links = [
  { href: "/dashboard/p2p", label: "Lifecycle" },
  { href: "/dashboard/p2p/items", label: "Items" },
  { href: "/dashboard/p2p/pr", label: "PR" },
  { href: "/dashboard/rfq", label: "RFQ" },
  { href: "/dashboard/p2p/po", label: "PO" },
  { href: "/dashboard/p2p/grn", label: "GRN" },
  { href: "/dashboard/p2p/ses", label: "SES" },
  { href: "/dashboard/ap", label: "Invoices" },
  { href: "/dashboard/p2p/match", label: "3-Way Match" },
  { href: "/dashboard/p2p/payments", label: "Payments" },
]

export function P2pNav() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1">
      {links.map((link) => {
        const active =
          link.href === "/dashboard/p2p"
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-sm",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
