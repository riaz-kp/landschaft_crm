// Expands a short Google Maps share link (maps.app.goo.gl/…) to the full link,
// so the CRM can read the pin's coordinates out of it.
//
//   { url: 'https://maps.app.goo.gl/AbC123' }  →  { url: 'https://www.google.com/maps/place/…' }
//
// A browser cannot follow these redirects itself (Google sends no CORS
// headers), so the CRM asks through here. Only Google Maps short links are
// accepted and only redirects to Google are followed, so this cannot be used
// to fetch anything else. Nothing is stored.
//
// Only signed-in staff with an active login may call it.
// Deployed with verify_jwt off, like plants: the caller's token is checked here.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl', 'g.co'])
const GOOGLE = /(^|\.)(google\.[a-z.]+|goo\.gl|g\.co|app\.goo\.gl)$/i
const MAX_HOPS = 6

class Refusal extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const admin: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

async function checkCaller(req: Request): Promise<void> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new Refusal('Sign in first.', 401)
  const { data: auth, error } = await admin.auth.getUser(token)
  if (error || !auth.user) throw new Refusal('Your session has expired. Sign in again.', 401)
  const { data: link } = await admin.from('app_users').select('active').eq('user_id', auth.user.id).maybeSingle()
  if (!link?.active) throw new Refusal('Your login is not active.', 403)
}

/** Follows the redirects one at a time, staying on Google, and returns where they end. */
async function expand(raw: unknown): Promise<string> {
  if (typeof raw !== 'string' || raw.length > 500) throw new Refusal('Paste a Google Maps link.')
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`)
  } catch {
    throw new Refusal('That is not a link.')
  }
  if (!SHORT_HOSTS.has(url.hostname.toLowerCase())) throw new Refusal('Only Google Maps share links can be expanded.')
  url.protocol = 'https:'

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    let res: Response
    try {
      res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CRM map link)' } })
    } catch {
      throw new Refusal('Google Maps did not answer. Try again in a minute.', 502)
    }
    await res.body?.cancel()
    const next = res.headers.get('location')
    if (res.status < 300 || res.status >= 400 || !next) {
      if (hop === 0) throw new Refusal('That share link did not lead anywhere. Check it is the whole link.')
      return url.href
    }
    const target = new URL(next, url)
    if (!GOOGLE.test(target.hostname)) throw new Refusal('That link does not lead to Google Maps.')
    // A full maps link: the coordinates are in it, so no need to go further.
    if (/\/maps\b|[?&](q|ll)=/.test(target.pathname + target.search) && !SHORT_HOSTS.has(target.hostname)) return target.href
    url = target
  }
  return url.href
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405)
  try {
    await checkCaller(req)
    const body = await req.json().catch(() => ({})) as { url?: unknown }
    return reply({ url: await expand(body.url) })
  } catch (e) {
    if (e instanceof Refusal) return reply({ error: e.message }, e.status)
    console.error(e)
    return reply({ error: 'Could not read that link.' }, 500)
  }
})
