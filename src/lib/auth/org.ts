import { randomUUID } from "crypto"

import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"
import {
  isUserRole,
  type UserRole,
} from "@/lib/auth/roles"

export type { UserRole }

export type OrgContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  orgId: string
  role: UserRole
  email: string
  displayName: string
}

export type OrgContextResult =
  | { ok: true; ctx: OrgContext }
  | { ok: false; error: string }

export const SIGN_IN_REQUIRED =
  "Sign in to load live data. Open /login to create an account or sign in."

type SessionClientResult =
  | {
      ok: true
      supabase: Awaited<ReturnType<typeof createClient>>
      userId: string
      email: string
      displayName: string
    }
  | { ok: false; error: string }

function claimString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function metadataRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return metadataRecord(JSON.parse(value) as unknown)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function displayNameFromEmail(email: string) {
  const local = email.split("@")[0] ?? ""
  const formatted = local
    .split(/[._+\-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
  return formatted || "there"
}

export function displayNameFromProfile(input: {
  email: string
  metadata?: unknown
}) {
  const metadata = metadataRecord(input.metadata)
  const fromMetadata =
    claimString(metadata?.full_name) ||
    claimString(metadata?.name) ||
    claimString(metadata?.display_name)
  if (fromMetadata) return fromMetadata
  return displayNameFromEmail(input.email)
}

export async function getLoggedInDisplayName() {
  const session = await getSessionClient()
  return session.ok ? session.displayName : "there"
}

export async function ensureOrgProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string,
  role: UserRole = "admin"
) {
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle()

  if (existing) return

  // Generate the org id in-app. Insert+select on organizations fails under RLS
  // because SELECT is scoped to private.user_org_id(), which is null until the
  // users row exists.
  const orgId = randomUUID()
  const { error: orgError } = await supabase.from("organizations").insert({
    id: orgId,
    name: "SBC LLP",
    base_currency: "INR",
  })

  if (orgError) {
    throw new Error(orgError.message)
  }

  const { error: profileError } = await supabase.from("users").insert({
    id: userId,
    org_id: orgId,
    email,
    role,
  })

  if (profileError) {
    throw new Error(profileError.message)
  }
}

export async function getSessionClient(): Promise<SessionClientResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error:
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.",
    }
  }

  const supabase = await createClient()
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  const userId = claimString(claimsData?.claims?.sub)
  if (claimsError || !userId) {
    return { ok: false, error: SIGN_IN_REQUIRED }
  }

  const email = claimString(claimsData?.claims?.email)
  const claims = metadataRecord(claimsData?.claims)

  return {
    ok: true,
    supabase,
    userId,
    email,
    displayName: displayNameFromProfile({
      email,
      metadata: claims?.user_metadata,
    }),
  }
}

export async function requireOrgContext(): Promise<OrgContextResult> {
  const session = await getSessionClient()
  if (!session.ok) return session

  const { supabase, userId, email, displayName } = session

  const loadProfile = () =>
    supabase.from("users").select("org_id, role").eq("id", userId).maybeSingle()

  let { data: profile, error: profileError } = await loadProfile()

  if (!profile?.org_id && email) {
    try {
      await ensureOrgProfile(supabase, userId, email)
      ;({ data: profile, error: profileError } = await loadProfile())
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not create an organization membership for this user.",
      }
    }
  }

  if (profileError || !profile?.org_id) {
    return {
      ok: false,
      error:
        "No organization profile found for your user. Create an organization membership first.",
    }
  }

  const role = isUserRole(String(profile.role ?? ""))
    ? (profile.role as UserRole)
    : "requester"

  return {
    ok: true,
    ctx: {
      supabase,
      userId,
      orgId: profile.org_id as string,
      role,
      email,
      displayName,
    },
  }
}

export {
  canApproveBills,
  canApproveBillAmount,
  canReviewApprovals,
} from "@/lib/auth/roles"
