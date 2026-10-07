import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { LoginForm } from "@/app/login/login-form"
import { AppLogo } from "@/components/brand/app-logo"
import { APP_NAME } from "@/lib/brand"
import { getSessionClient } from "@/lib/auth/org"

export const metadata: Metadata = {
  title: "Sign in",
}

export default async function LoginPage() {
  const session = await getSessionClient()
  if (session.ok) {
    redirect("/select-company")
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xs">
        <div className="mb-6 flex items-center gap-3">
          <AppLogo size={40} className="size-10 shrink-0" priority />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{APP_NAME}</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to load invoices, bills, and audit logs.
            </p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
