import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The project URL, tidied. The dashboard also shows the REST endpoint
 * (".../rest/v1/"); pasted in by mistake it would send sign-in, storage and
 * functions to the wrong paths, so that suffix and any trailing slash go.
 */
const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '')
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

/**
 * The offline demo: seed data kept in this browser, and a switcher to view the
 * app as anyone. For showing the product; never for real company data.
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

export const supabaseConfigured = Boolean(url && key)

/**
 * Staff sign in with a username. Supabase Auth keys every login by email, so a
 * username stands for an address on a domain reserved never to receive mail
 * (RFC 2606). Keep in step with LOGIN_DOMAIN in supabase/functions/staff-accounts.
 */
export const LOGIN_DOMAIN = 'users.landschaft.invalid'

/** 3–32 characters: lowercase letters and digits, with . _ - after the first. */
export const USERNAME_RULE = /^[a-z0-9][a-z0-9._-]{2,31}$/
export const USERNAME_HINT = '3–32 lowercase letters or digits; dots, dashes and underscores after the first. No spaces.'

export const normaliseUsername = (typed: string) => typed.trim().toLowerCase()

/**
 * The Auth email behind what was typed in the Username box. Logins made before
 * usernames still carry the person's own email until an admin gives them a
 * username, so anything with an @ is used as it is.
 */
export function loginEmail(typed: string): string {
  const value = normaliseUsername(typed)
  return value.includes('@') ? value : `${value}@${LOGIN_DOMAIN}`
}

/** What a person types to sign in with this Auth email: the username, or a pre-username login's own email. */
export const loginName = (email: string) => email.replace(`@${LOGIN_DOMAIN}`, '')

/** A starting username from a name: "Ashfaq Rahman" → "ashfaq". */
export function suggestUsername(name: string): string {
  return name.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z0-9]/g, '') ?? ''
}

let client: SupabaseClient | null = null

/**
 * Where Supabase keeps the login in this browser. Its own default, named here
 * so the app can tell a login is still stored while the server is out of reach.
 */
const AUTH_STORAGE_KEY = (() => {
  try {
    return `sb-${new URL(url ?? '').hostname.split('.')[0]}-auth-token`
  } catch {
    return '' // No valid URL: the client is never created, so there is no login to find.
  }
})()

export function supabase(): SupabaseClient {
  if (!client) {
    if (!url || !key) throw new Error('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_STORAGE_KEY },
    })
  }
  return client
}

/**
 * The user whose login this browser still holds, without asking the server.
 * With no connection an expired sign-in cannot be renewed, so Supabase reports
 * no session even though nobody signed out; this tells the two apart.
 */
export function storedLoginUserId(): string | null {
  try {
    const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? 'null') as { user?: { id?: string } } | null
    return stored?.user?.id ?? null
  } catch {
    return null
  }
}

/** Drops the login kept in this browser, for signing out when the server cannot be reached to do it. */
export function forgetStoredLogin() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // Storage blocked: there is nothing stored to forget.
  }
}

/** A request that never reached the server (no signal, a dropped connection) rather than one it refused. */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const message = error instanceof Error ? error.message : String((error as { message?: unknown } | null)?.message ?? error)
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(message)
}

/**
 * Calls the staff-accounts Edge Function. Its refusals ("That username is
 * taken.") come back as the thrown error's message.
 */
export function staffAccounts<T = { ok: true }>(body: Record<string, unknown>): Promise<T> {
  return callFunction<T>('staff-accounts', body)
}

/** Calls an Edge Function; a refusal's own wording becomes the thrown error's message. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().functions.invoke(name, { body })
  if (error) {
    const response = (error as { context?: Response }).context
    const message = response && typeof response.json === 'function'
      ? await response.json().then((b: { error?: string }) => b.error).catch(() => undefined)
      : undefined
    throw new Error(message ?? 'Could not reach the server. Check the connection and try again.')
  }
  return data as T
}
