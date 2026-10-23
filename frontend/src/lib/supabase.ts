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

let client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (!client) {
    if (!url || !key) throw new Error('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}

/**
 * Calls the staff-accounts Edge Function. Its refusals ("That email already has
 * a login.") come back as the thrown error's message.
 */
export async function staffAccounts<T = { ok: true }>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().functions.invoke('staff-accounts', { body })
  if (error) {
    const response = (error as { context?: Response }).context
    const message = response && typeof response.json === 'function'
      ? await response.json().then((b: { error?: string }) => b.error).catch(() => undefined)
      : undefined
    throw new Error(message ?? 'Could not reach the server. Check the connection and try again.')
  }
  return data as T
}
