"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { ensureOrgProfile } from "@/lib/auth/org"
import { parseAssignableRole } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/env"

export type AuthFormState =
  | { success: true }
  | { success: false; error: string }

export async function signInWithPassword(
  _prev: AuthFormState | null,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase is not configured." }
  }

  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { success: false, error: "Email and password are required." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    return { success: false, error: error?.message ?? "Unable to sign in." }
  }

  try {
    await ensureOrgProfile(supabase, data.user.id, data.user.email ?? email)
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Signed in, but profile setup failed.",
    }
  }

  revalidatePath("/dashboard")
  redirect("/dashboard")
}

export async function signUpWithPassword(
  _prev: AuthFormState | null,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase is not configured." }
  }

  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const role = parseAssignableRole(formData.get("role"))

  if (!email || !password) {
    return { success: false, error: "Email and password are required." }
  }
  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters." }
  }
  if (!role) {
    return { success: false, error: "Select a role." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  let user = data.user
  let session = data.session

  if (!session) {
    const signedIn = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signedIn.error || !signedIn.data.user) {
      return {
        success: false,
        error:
          signedIn.error?.message ??
          "Account created, but email confirmation is still enabled on this project. Turn off Confirm email in Supabase Auth settings, then sign in.",
      }
    }

    user = signedIn.data.user
    session = signedIn.data.session
  }

  if (!user) {
    return { success: false, error: "Unable to create a signed-in session." }
  }

  try {
    await ensureOrgProfile(supabase, user.id, user.email ?? email, role)
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Account created, but profile setup failed.",
    }
  }

  revalidatePath("/dashboard")
  redirect("/dashboard")
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }

  revalidatePath("/dashboard")
  redirect("/login")
}
