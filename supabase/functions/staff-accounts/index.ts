// Staff logins for Landschaft CRM.
//
// Creating, resetting and disabling a login needs the service role, so it
// happens here rather than in the browser. Every action except `status` and
// the one-time `bootstrap` checks that the caller is signed in and may edit
// Employees, mirroring hasPermission() in frontend/src/domain/roles.ts.
//
// Deployed with verify_jwt off: `status` and `bootstrap` run before anyone is
// signed in, and the caller's token is checked here for everything else.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const TOP_ROLES = ['super_admin', 'ceo']
const MIN_PASSWORD = 8

// Staff sign in with a username. Auth keys logins by email, so a username
// stands for an address on a domain reserved never to receive mail (RFC 2606).
// Keep in step with LOGIN_DOMAIN in frontend/src/lib/supabase.ts.
const LOGIN_DOMAIN = 'users.landschaft.invalid'
const USERNAME_RULE = /^[a-z0-9][a-z0-9._-]{2,31}$/

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

interface Caller {
  userId: string
  employeeId: string
  role: string
}

async function record<T>(table: string, id: string): Promise<T | null> {
  const { data, error } = await admin.from(table).select('data').eq('id', id).maybeSingle()
  if (error) throw error
  return (data?.data as T) ?? null
}

async function caller(req: Request): Promise<Caller> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new Refusal('Sign in first.', 401)
  const { data: auth, error } = await admin.auth.getUser(token)
  if (error || !auth.user) throw new Refusal('Your session has expired. Sign in again.', 401)
  const { data: link } = await admin.from('app_users').select('employee_id, active').eq('user_id', auth.user.id).maybeSingle()
  if (!link?.active) throw new Refusal('Your login is not active.', 403)
  const employee = await record<{ role: string }>('employees', link.employee_id)
  if (!employee) throw new Refusal('Your employee record is missing.', 403)
  return { userId: auth.user.id, employeeId: link.employee_id, role: employee.role }
}

type Permission = { view?: boolean; edit?: boolean }

async function canManageEmployees(who: Caller): Promise<boolean> {
  if (who.role === 'super_admin') return true
  if (who.role === 'foreman') return false
  const settings = await record<{ permissions?: Record<string, Record<string, Permission>> }>('settings', 'main')
  const entry = settings?.permissions?.[who.role]?.Employees
  return Boolean(entry?.view && entry?.edit)
}

/** The employee a login is for, checked against what the caller may touch. */
async function target(who: Caller, employeeId: unknown) {
  if (typeof employeeId !== 'string' || !employeeId) throw new Refusal('Which employee?')
  const employee = await record<{ role: string; name: string }>('employees', employeeId)
  if (!employee) throw new Refusal('That employee no longer exists.', 404)
  if (TOP_ROLES.includes(employee.role) && !TOP_ROLES.includes(who.role)) {
    throw new Refusal('Only a Super Admin or the CEO can manage that login.', 403)
  }
  const { data: link } = await admin.from('app_users').select('user_id, email, active').eq('employee_id', employeeId).maybeSingle()
  return { employee, link }
}

function cleanEmail(value: unknown): string {
  const email = String(value ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Refusal('Enter a valid email address.')
  return email
}

function cleanUsername(value: unknown): string {
  const username = String(value ?? '').trim().toLowerCase()
  if (!USERNAME_RULE.test(username)) {
    throw new Refusal('Use 3–32 lowercase letters or digits for the username; dots, dashes and underscores after the first. No spaces.')
  }
  return username
}

/**
 * The login a request asks for: a username (and the address behind it), or —
 * from an app built before usernames — an email on its own.
 */
function requestedLogin(body: Record<string, unknown>): { email: string; username: string | null } {
  if (typeof body.username === 'string') {
    const username = cleanUsername(body.username)
    return { email: `${username}@${LOGIN_DOMAIN}`, username }
  }
  return { email: cleanEmail(body.email), username: null }
}

async function usernameTaken(username: string, exceptUserId?: string): Promise<boolean> {
  let query = admin.from('app_users').select('user_id').eq('username', username)
  if (exceptUserId) query = query.neq('user_id', exceptUserId)
  const { data, error } = await query.limit(1)
  if (error) throw error
  return (data ?? []).length > 0
}

function checkPassword(value: unknown): string {
  const password = String(value ?? '')
  if (password.length < MIN_PASSWORD) throw new Refusal(`Use at least ${MIN_PASSWORD} characters for the password.`)
  return password
}

async function noLoginsYet(): Promise<boolean> {
  const { count, error } = await admin.from('app_users').select('user_id', { count: 'exact', head: true })
  if (error) throw error
  return (count ?? 0) === 0
}

async function createLogin(login: { email: string; username: string | null }, password: string, employeeId: string) {
  const { email, username } = login
  if (username && (await usernameTaken(username))) throw new Refusal('That username is taken. Choose another.', 409)
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { employee_id: employeeId },
  })
  if (error || !data.user) {
    const taken = error?.message.toLowerCase().includes('already')
    const which = username ? 'That username is taken. Choose another.' : 'That email already has a login.'
    throw new Refusal(taken ? which : error?.message ?? 'The login could not be created.')
  }
  const { error: linkError } = await admin.from('app_users').insert({ user_id: data.user.id, employee_id: employeeId, email, username })
  if (linkError) {
    await admin.auth.admin.deleteUser(data.user.id)
    throw linkError
  }
  return data.user.id
}

async function handle(req: Request): Promise<unknown> {
  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  switch (action) {
    // Whether the first admin still has to be set up — shown on the sign-in page.
    case 'status':
      return { needsSetup: await noLoginsYet() }

    // The very first login: a Super Admin, allowed only while no login exists.
    case 'bootstrap': {
      if (!(await noLoginsYet())) throw new Refusal('This CRM is already set up. Sign in instead.', 409)
      const name = String(body.name ?? '').trim()
      if (!name) throw new Refusal('Enter your name.')
      const login = requestedLogin(body)
      const password = checkPassword(body.password)
      const employeeId = `e${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
      const { error } = await admin.from('employees').insert({
        id: employeeId,
        data: { id: employeeId, name, role: 'super_admin', department: 'Management', phone: '', email: login.username ? '' : login.email },
      })
      if (error) throw error
      try {
        const userId = await createLogin(login, password, employeeId)
        // Two set-ups racing each other: keep the first, undo this one.
        const { data: first } = await admin.from('app_users').select('user_id').order('created_at').limit(1).single()
        if (first?.user_id !== userId) {
          await admin.auth.admin.deleteUser(userId)
          throw new Refusal('This CRM was set up a moment ago. Sign in instead.', 409)
        }
      } catch (e) {
        await admin.from('employees').delete().eq('id', employeeId)
        throw e
      }
      return { ok: true }
    }

    case 'create': {
      const who = await caller(req)
      if (!(await canManageEmployees(who))) throw new Refusal('You cannot manage logins.', 403)
      const { link } = await target(who, body.employeeId)
      if (link) throw new Refusal('This employee already has a login.', 409)
      await createLogin(requestedLogin(body), checkPassword(body.password), body.employeeId)
      return { ok: true }
    }

    // Gives a login a new username — or its first, moving a pre-username login off its email.
    case 'set-username': {
      const who = await caller(req)
      if (!(await canManageEmployees(who))) throw new Refusal('You cannot manage logins.', 403)
      const { link } = await target(who, body.employeeId)
      if (!link) throw new Refusal('This employee has no login yet.', 404)
      const username = cleanUsername(body.username)
      if (await usernameTaken(username, link.user_id)) throw new Refusal('That username is taken. Choose another.', 409)
      const email = `${username}@${LOGIN_DOMAIN}`
      const { error } = await admin.auth.admin.updateUserById(link.user_id, { email, email_confirm: true })
      if (error) {
        throw new Refusal(error.message.toLowerCase().includes('already') ? 'That username is taken. Choose another.' : error.message)
      }
      const { error: linkError } = await admin.from('app_users').update({ username, email }).eq('user_id', link.user_id)
      if (linkError) throw linkError
      return { ok: true }
    }

    case 'set-password': {
      const who = await caller(req)
      if (!(await canManageEmployees(who))) throw new Refusal('You cannot manage logins.', 403)
      const { link } = await target(who, body.employeeId)
      if (!link) throw new Refusal('This employee has no login yet.', 404)
      const { error } = await admin.auth.admin.updateUserById(link.user_id, { password: checkPassword(body.password) })
      if (error) throw new Refusal(error.message)
      return { ok: true }
    }

    case 'set-active': {
      const who = await caller(req)
      if (!(await canManageEmployees(who))) throw new Refusal('You cannot manage logins.', 403)
      if (body.employeeId === who.employeeId) throw new Refusal('You cannot switch off your own login.')
      const { link } = await target(who, body.employeeId)
      if (!link) throw new Refusal('This employee has no login yet.', 404)
      const active = Boolean(body.active)
      // A ban also ends the sessions they already have open.
      const { error } = await admin.auth.admin.updateUserById(link.user_id, { ban_duration: active ? 'none' : '876000h' })
      if (error) throw new Refusal(error.message)
      await admin.from('app_users').update({ active }).eq('user_id', link.user_id)
      return { ok: true }
    }

    // When an employee is deleted, their login goes with them.
    case 'remove': {
      const who = await caller(req)
      if (!(await canManageEmployees(who))) throw new Refusal('You cannot manage logins.', 403)
      if (body.employeeId === who.employeeId) throw new Refusal('You cannot remove your own login.')
      const { link } = await target(who, body.employeeId)
      if (link) await admin.auth.admin.deleteUser(link.user_id)
      return { ok: true }
    }

    default:
      throw new Refusal('Unknown action.')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405)
  try {
    return reply(await handle(req))
  } catch (e) {
    if (e instanceof Refusal) return reply({ error: e.message }, e.status)
    console.error(e)
    return reply({ error: 'Something went wrong on the server.' }, 500)
  }
})
