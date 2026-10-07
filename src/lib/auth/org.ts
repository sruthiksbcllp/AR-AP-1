import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"
import { isUserRole, type UserRole } from "@/lib/auth/roles"
import type { CompanyMembership } from "@/lib/auth/company"

export type { UserRole }

export const NO_COMPANY_SELECTED =
  "Select your company to load that company's data."

export type OrgContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  orgId: string
  orgName: string
  role: UserRole
  email: string
  displayName: string
  companies: CompanyMembership[]
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
  role: UserRole = "requester"
) {
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle()

  if (existing) return

  const { error: profileError } = await supabase.from("users").insert({
    id: userId,
    org_id: null,
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

export async function getCompanyMemberships(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<CompanyMembership[]> {
  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("org_id, role")
    .eq("user_id", userId)

  const rows = memberships ?? []
  if (rows.length === 0) return []

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name")
    .in(
      "id",
      rows.map((row) => row.org_id)
    )

  const names = new Map((orgs ?? []).map((org) => [org.id, org.name]))
  return rows
    .map((row) => ({
      id: String(row.org_id),
      name: names.get(row.org_id) ?? "Company",
      role: String(row.role),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function requireOrgContext(): Promise<OrgContextResult> {
  const session = await getSessionClient()
  if (!session.ok) return session

  const { supabase, userId, email, displayName } = session

  const loadProfile = () =>
    supabase.from("users").select("org_id, role").eq("id", userId).maybeSingle()

  let { data: profile, error: profileError } = await loadProfile()

  if (!profile && email) {
    try {
      await ensureOrgProfile(supabase, userId, email)
      ;({ data: profile, error: profileError } = await loadProfile())
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not create a profile for this user.",
      }
    }
  }

  if (profileError) {
    return { ok: false, error: profileError.message }
  }

  const companies = await getCompanyMemberships(supabase, userId)

  if (!profile?.org_id) {
    return { ok: false, error: NO_COMPANY_SELECTED }
  }

  const role = isUserRole(String(profile.role ?? ""))
    ? (profile.role as UserRole)
    : "requester"

  const active = companies.find((company) => company.id === profile.org_id)
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", profile.org_id)
    .maybeSingle()

  return {
    ok: true,
    ctx: {
      supabase,
      userId,
      orgId: profile.org_id as string,
      orgName: org?.name ?? active?.name ?? "Company",
      role,
      email,
      displayName,
      companies,
    },
  }
}

export {
  canApproveBills,
  canApproveBillAmount,
  canReviewApprovals,
} from "@/lib/auth/roles"
