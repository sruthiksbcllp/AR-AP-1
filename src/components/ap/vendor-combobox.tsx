"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type VendorChoice = {
  id: string
  name: string
  email: string | null
}

type VendorComboboxProps = {
  id?: string
  vendors: VendorChoice[]
  value: string
  onChange: (vendorId: string) => void
  disabled?: boolean
}

export function VendorCombobox({
  id = "vendor_id",
  vendors,
  value,
  onChange,
  disabled = false,
}: VendorComboboxProps) {
  const selected = vendors.find((vendor) => vendor.id === value) ?? null
  const [query, setQuery] = React.useState(selected?.name ?? "")
  const [open, setOpen] = React.useState(false)
  const boxRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setQuery(selected?.name ?? "")
  }, [selected?.id, selected?.name])

  React.useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!boxRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  const wanted = query.trim().toLowerCase()
  const matches = vendors.filter((vendor) => {
    if (!wanted) return true
    return (
      vendor.name.toLowerCase().includes(wanted) ||
      (vendor.email ?? "").toLowerCase().includes(wanted)
    )
  })

  function pick(vendor: VendorChoice) {
    onChange(vendor.id)
    setQuery(vendor.name)
    setOpen(false)
  }

  function onQueryChange(next: string) {
    setQuery(next)
    setOpen(true)
    const exact = vendors.find(
      (vendor) => vendor.name.toLowerCase() === next.trim().toLowerCase()
    )
    onChange(exact?.id ?? "")
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Type to find a vendor"
          value={query}
          disabled={disabled}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false)
              return
            }
            if (event.key === "Enter" && matches[0]) {
              event.preventDefault()
              pick(matches[0])
            }
          }}
          className="pr-8"
        />
        <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {open ? (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-popover p-1 text-sm shadow-md"
        >
          {matches.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">
              No matching vendor. Use Add vendor to create one.
            </li>
          ) : (
            matches.map((vendor) => (
              <li key={vendor.id} role="option" aria-selected={vendor.id === value}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground",
                    vendor.id === value && "bg-accent"
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(vendor)}
                >
                  <span className="min-w-0 truncate">
                    {vendor.name}
                    {vendor.email ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {vendor.email}
                      </span>
                    ) : null}
                  </span>
                  {vendor.id === value ? (
                    <Check className="size-4 shrink-0" />
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
