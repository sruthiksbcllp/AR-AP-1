import { cookies } from "next/headers"

export const COMPANY_COOKIE = "arap_company_id"

export type CompanyMembership = {
  id: string
  name: string
  role: string
}

export async function getSelectedCompanyCookie() {
  const store = await cookies()
  return store.get(COMPANY_COOKIE)?.value ?? null
}

export async function setSelectedCompanyCookie(orgId: string) {
  const store = await cookies()
  store.set(COMPANY_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
}

export async function clearSelectedCompanyCookie() {
  const store = await cookies()
  store.delete(COMPANY_COOKIE)
}
