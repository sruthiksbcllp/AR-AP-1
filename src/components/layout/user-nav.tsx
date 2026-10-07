"use client"

import { ChevronsUpDown, LogOut, Settings, User } from "lucide-react"

import { signOut } from "@/app/login/actions"
import { APP_LOGO_SRC, APP_NAME } from "@/lib/brand"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserNav({
  displayName = "Workspace user",
  roleLabel = APP_NAME,
}: {
  displayName?: string
  roleLabel?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 px-1.5 data-[state=open]:bg-muted"
        >
          <Avatar className="size-7 rounded-lg">
            <AvatarImage src={APP_LOGO_SRC} alt={APP_NAME} />
            <AvatarFallback className="rounded-lg text-xs">SBC</AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 flex-1 text-left text-sm leading-tight md:grid">
            <span className="truncate font-medium">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">
              {roleLabel}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto hidden size-3.5 opacity-50 md:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <User className="size-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="size-4" />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void signOut()
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
