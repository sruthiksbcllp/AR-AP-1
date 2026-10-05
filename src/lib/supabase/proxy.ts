import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { getSupabaseEnv } from "@/lib/supabase/env"

function isLoginPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/")
}

function withCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value)
  })
  return to
}

function redirectWithCookies(
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string
) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ""
  return withCookies(sessionResponse, NextResponse.redirect(url))
}

export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv()
  const pathname = request.nextUrl.pathname

  if (!env) {
    if (isLoginPath(pathname)) {
      return NextResponse.next({ request })
    }
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    return NextResponse.redirect(url)
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-pathname", pathname)

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({
          request: { headers: requestHeaders },
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value)
        )
      },
    },
  })

  // Refresh / verify the session. Do not place logic between createServerClient
  // and getClaims() — it can cause intermittent sign-outs.
  const { data } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(data?.claims?.sub)

  if (!isAuthenticated && !isLoginPath(pathname)) {
    return redirectWithCookies(request, supabaseResponse, "/login")
  }

  if (isAuthenticated && isLoginPath(pathname)) {
    return redirectWithCookies(request, supabaseResponse, "/dashboard")
  }

  return supabaseResponse
}
