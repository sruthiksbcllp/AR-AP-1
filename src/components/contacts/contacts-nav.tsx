"use client"

import Link from "next/link"

import { cn } from "cn"

const links = [
  { href: "/dashboard/contacts", label: "Vendor onboarding" },
  { href: "/dashboard/contacts?view=customers", label: "Customers" },
]

export function ContactsNav({ view }: { view: "vendors" | "customers" }) {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1">
      {links.map((link) => {
        const active =
          link.href === "/dashboard/contacts"
            ? view === "vendors"
            : view === "customers"

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
