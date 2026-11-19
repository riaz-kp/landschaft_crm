// Push notifications for Landschaft CRM: reminders, site visits and
// consultations in the phone's or computer's notification panel, the CRM open
// or not (Windows, macOS, Android, and iPhone/iPad once added to the Home Screen).
//
//   { action: 'run' }    Sends whatever is due. Called every minute by pg_cron
//                        (migration 20261119120000_push_notifications.sql) with
//                        the x-push-cron secret from Vault.
//   { action: 'test' }   A signed-in employee: a test notification to this
//                        device (`endpoint`), so they see it works.
//
// The key pair push services check our messages against is made here on first
// use and kept in Vault; browsers subscribe with its public half
// (public.push_public_key()). Devices are registered by public.push_subscribe().
//
// Deployed with verify_jwt off: pg_cron has no login, and `test` checks the
// caller itself.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { generateVapidKeys, sendPush, type Subscription, type VapidKeys } from './webpush.ts'
import { addDays, duePushes, indiaDate, type Consultation, type Person, type Push, type Reminder, type SiteVisit } from './schedule.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Who push services contact about our messages. Apple requires one. */
const SUBJECT = 'https://crm.landschaft.in'

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

interface Config {
  keys: VapidKeys
  cronSecret: string
}

let config: Config | null = null

/** The key pair and cron secret from Vault; the key pair is made the first time. */
async function loadConfig(): Promise<Config> {
  if (config) return config
  let { data, error } = await admin.rpc('push_config')
  if (error) throw error
  if (!data?.push_vapid_private) {
    const made = await generateVapidKeys()
    ;({ data, error } = await admin.rpc('push_init', { p_public: made.publicKey, p_private: made.privateKey }))
    if (error) throw error
  }
  if (!data?.push_vapid_public || !data?.push_vapid_private || !data?.push_cron_secret) {
    throw new Error('Push is not set up: run the push notifications migration.')
  }
  config = { keys: { publicKey: data.push_vapid_public, privateKey: data.push_vapid_private }, cronSecret: data.push_cron_secret }
  return config
}

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

interface Device extends Subscription {
  employee_id: string
}

/** Sends one message to some devices; forgets the ones push services say are gone. Returns how many were delivered. */
async function deliver(devices: Device[], push: Pick<Push, 'title' | 'body' | 'url'> & { tag: string }): Promise<number> {
  const { keys } = await loadConfig()
  const message = JSON.stringify({ title: push.title, body: push.body, url: push.url, tag: push.tag })
  const results = await Promise.all(devices.map((d) =>
    sendPush(d, message, keys, { subject: SUBJECT }).catch((e: unknown) => ({ status: 0, gone: false, detail: String(e) }))))
  const gone = devices.filter((_, i) => results[i].gone).map((d) => d.endpoint)
  if (gone.length) await admin.from('push_subscriptions').delete().in('endpoint', gone)
  results.forEach((r, i) => {
    if (r.status >= 300 && !r.gone) console.warn('push refused', new URL(devices[i].endpoint).host, r.status, r.detail)
  })
  return results.filter((r) => r.status >= 200 && r.status < 300).length
}

// ---------------------------------------------------------------- run: what is due

async function rows<T>(query: PromiseLike<{ data: { id: string; data: T; created_at?: string }[] | null; error: unknown }>) {
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

async function run(): Promise<{ due: number; sent: number }> {
  const { data: subs, error } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth, employee_id, user_id')
  if (error) throw error
  if (!subs?.length) return { due: 0, sent: 0 }
  const { data: active, error: activeError } = await admin.from('app_users').select('user_id').eq('active', true)
  if (activeError) throw activeError
  const activeUsers = new Set((active ?? []).map((a) => a.user_id))
  const devicesOf = new Map<string, Device[]>()
  for (const s of subs) {
    if (!activeUsers.has(s.user_id)) continue
    devicesOf.set(s.employee_id, [...(devicesOf.get(s.employee_id) ?? []), s])
  }
  if (!devicesOf.size) return { due: 0, sent: 0 }

  const now = Date.now()
  const today = indiaDate(now)
  const [employees, reminders, visits, consultations] = await Promise.all([
    rows<{ name?: string; role?: string }>(admin.from('employees').select('id, data')),
    rows<Reminder>(admin.from('reminders').select('id, data, created_at')),
    rows<SiteVisit>(admin.from('site_visits').select('id, data')
      .eq('data->>status', 'Scheduled').gte('data->>date', today).lte('data->>date', addDays(today, 31))),
    rows<Consultation>(admin.from('consultations').select('id, data')
      .eq('data->>status', 'Scheduled').in('data->>date', [today, addDays(today, 1)])),
  ])

  const wanted = [...new Set([...visits.map((v) => v.data), ...consultations.map((c) => c.data)]
    .flatMap((x) => [x.leadId, x.clientId]).filter((id): id is string => Boolean(id)))]
  const names = new Map<string, string>()
  if (wanted.length) {
    const [leads, clients] = await Promise.all([
      rows<{ name?: string }>(admin.from('leads').select('id, data').in('id', wanted)),
      rows<{ name?: string }>(admin.from('clients').select('id, data').in('id', wanted)),
    ])
    for (const r of [...leads, ...clients]) if (r.data.name) names.set(r.id, r.data.name)
  }

  const people: Person[] = employees.map((e) => ({ id: e.id, name: e.data.name ?? '', role: e.data.role ?? '' }))
  const pushes = duePushes({
    now,
    people,
    reminders: reminders.map((r) => ({ reminder: { ...r.data, id: r.id }, createdAt: Date.parse(r.created_at ?? '') || 0 })),
    visits: visits.map((v) => ({ ...v.data, id: v.id })),
    consultations: consultations.map((c) => ({ ...c.data, id: c.id })),
    names,
  })

  // Claim each (push, person) before sending, so overlapping runs never send twice.
  const wantedKeys = pushes.flatMap((p) => p.to.filter((id) => devicesOf.has(id)).map((id) => `${p.key}:${id}`))
  if (!wantedKeys.length) return { due: pushes.length, sent: 0 }
  const { data: claimed, error: claimError } = await admin.from('push_sent')
    .upsert(wantedKeys.map((key) => ({ key })), { onConflict: 'key', ignoreDuplicates: true }).select('key')
  if (claimError) throw claimError
  const mine = new Set((claimed ?? []).map((c) => c.key as string))

  let sent = 0
  const unsent: string[] = []
  await Promise.all(pushes.flatMap((p) => p.to.map(async (id) => {
    const key = `${p.key}:${id}`
    if (!mine.has(key)) return
    const delivered = await deliver(devicesOf.get(id)!, { ...p, tag: p.key })
    sent += delivered
    if (!delivered) unsent.push(key)
  })))
  // Nothing reached that person (push service down?): try again next minute while it is still due.
  if (unsent.length) await admin.from('push_sent').delete().in('key', unsent)
  await admin.from('push_sent').delete().lt('sent_at', new Date(now - 3 * 86_400_000).toISOString())
  return { due: pushes.length, sent }
}

// ---------------------------------------------------------------- test: this device

async function test(req: Request, endpoint: unknown): Promise<{ sent: number }> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new Refusal('Sign in first.', 401)
  const { data: auth, error } = await admin.auth.getUser(token)
  if (error || !auth.user) throw new Refusal('Your session has expired. Sign in again.', 401)
  let query = admin.from('push_subscriptions').select('endpoint, p256dh, auth, employee_id').eq('user_id', auth.user.id)
  if (typeof endpoint === 'string' && endpoint) query = query.eq('endpoint', endpoint)
  const { data: devices, error: devicesError } = await query
  if (devicesError) throw devicesError
  if (!devices?.length) throw new Refusal('Notifications are not turned on for this device yet.', 404)
  const sent = await deliver(devices, {
    title: 'Notifications are on',
    body: 'Reminders, site visits and consultations will show up here.',
    url: '/calendar',
    tag: 'test',
  })
  if (!sent) throw new Refusal('The notification could not be sent. Turn notifications off and on again on this device.', 502)
  return { sent }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405)
  try {
    const body = await req.json().catch(() => ({})) as { action?: string; endpoint?: unknown }
    // First, so the key pair exists before any browser asks for it.
    const { cronSecret } = await loadConfig()
    if (body.action === 'run') {
      if (!sameSecret(req.headers.get('x-push-cron') ?? '', cronSecret)) return reply({ error: 'Not allowed.' }, 401)
      return reply(await run())
    }
    if (body.action === 'test') return reply(await test(req, body.endpoint))
    return reply({ error: 'Unknown action.' }, 400)
  } catch (e) {
    if (e instanceof Refusal) return reply({ error: e.message }, e.status)
    console.error(e)
    return reply({ error: 'Something went wrong sending notifications.' }, 500)
  }
})
