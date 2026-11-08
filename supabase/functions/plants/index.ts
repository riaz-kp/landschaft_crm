// Plant lists from the Landschaft plants app, for BOQs and quotations.
//
//   { action: 'list' }        every project in the plants app, newest first (no plants)
//   { action: 'get', id }     one project with its plants: name, botanical name,
//                             category, photo, height / size, quantity, unit, rate
//
// Plants are chosen, sized and priced in the plants app (plants.landschaft.in);
// the CRM only reads them. The plants app's API takes a single admin login and
// accepts browser calls only from its own site, so the CRM asks through here:
// this function holds the login as secrets and calls the API server to server.
//
//   PLANTS_API_URL        the API, default https://api.landschaft.in
//   PLANTS_API_USERNAME   the plants app's admin username
//   PLANTS_API_PASSWORD   and its password
//
// Only signed-in office staff with an active login may call it, and it never
// writes to the plants app.
//
// Deployed with verify_jwt off, like staff-accounts: the caller's token is checked here.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const API = (Deno.env.get('PLANTS_API_URL') || 'https://api.landschaft.in').replace(/\/+$/, '') + '/api/v1'
const USERNAME = Deno.env.get('PLANTS_API_USERNAME') ?? ''
const PASSWORD = Deno.env.get('PLANTS_API_PASSWORD') ?? ''
/** The plants app's tokens last a week; a fresh one is taken well before that. */
const TOKEN_MS = 24 * 3600 * 1000
const PAGE = 100
const MAX_PROJECTS = 2000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

/** Office staff only: a signed-in user whose login is active and who is not a foreman. */
async function checkCaller(req: Request): Promise<void> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new Refusal('Sign in first.', 401)
  const { data: auth, error } = await admin.auth.getUser(token)
  if (error || !auth.user) throw new Refusal('Your session has expired. Sign in again.', 401)
  const { data: link } = await admin.from('app_users').select('employee_id, active').eq('user_id', auth.user.id).maybeSingle()
  if (!link?.active) throw new Refusal('Your login is not active.', 403)
  const { data: employee } = await admin.from('employees').select('data').eq('id', link.employee_id).maybeSingle()
  const role = (employee?.data as { role?: string } | undefined)?.role
  if (!role || role === 'foreman') throw new Refusal('Plant lists are for the office team.', 403)
}

// ---------------------------------------------------------------- the plants app's API

let session: { token: string; at: number } | null = null

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(API + path, { ...init, signal: AbortSignal.timeout(20_000) })
  } catch {
    throw new Refusal('The plants app did not answer. Try again in a minute.', 502)
  }
}

async function login(): Promise<string> {
  if (!USERNAME || !PASSWORD) {
    throw new Refusal('The link to the plants app is not set up yet: its login has not been saved on the server.', 503)
  }
  const res = await call('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  })
  if (res.status === 401) throw new Refusal('The plants app refused the saved login. Ask an admin to update it on the server.', 502)
  if (!res.ok) throw new Refusal(`The plants app could not sign in (${res.status}).`, 502)
  const body = await res.json() as { access_token?: string }
  if (!body.access_token) throw new Refusal('The plants app sent no sign-in token.', 502)
  session = { token: body.access_token, at: Date.now() }
  return session.token
}

/** A GET with the plants app's token, signing in again once if it has expired. */
async function get<T>(path: string): Promise<T> {
  let token = session && Date.now() - session.at < TOKEN_MS ? session.token : await login()
  let res = await call(path, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) {
    token = await login()
    res = await call(path, { headers: { Authorization: `Bearer ${token}` } })
  }
  if (res.status === 404) throw new Refusal('That project is no longer in the plants app.', 404)
  if (!res.ok) throw new Refusal(`The plants app answered with an error (${res.status}).`, 502)
  return await res.json() as T
}

// ---------------------------------------------------------------- shapes

interface ApiProject {
  id: string
  name: string
  client_name?: string | null
  location?: string | null
  is_locked?: boolean
  updated_at: string
  plant_count?: number
  plants?: ApiProjectPlant[]
}

interface ApiProjectPlant {
  plant_id: string
  notes?: string | null
  quantity?: number | null
  unit?: string | null
  optimum_height_size?: string | null
  rate?: number | null
  plant?: {
    common_name?: string
    scientific_name?: string | null
    category?: string
    image_url?: string | null
    icon_url?: string | null
    taxon?: { name?: string } | null
  } | null
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)
const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

/** A project as the CRM lists it. */
function summary(p: ApiProject) {
  return {
    id: p.id,
    name: p.name,
    clientName: text(p.client_name),
    location: text(p.location),
    plantCount: p.plant_count ?? p.plants?.length ?? 0,
    updatedAt: p.updated_at,
    locked: Boolean(p.is_locked),
  }
}

/** A plant as a document line (PlantLine in the CRM's domain/types). */
function line(pp: ApiProjectPlant) {
  const plant = pp.plant ?? {}
  return {
    plantId: pp.plant_id,
    name: text(plant.common_name) ?? 'Unnamed plant',
    botanical: text(plant.scientific_name) ?? text(plant.taxon?.name),
    category: text(plant.category) ?? 'Other',
    image: text(plant.image_url) ?? text(plant.icon_url),
    size: text(pp.optimum_height_size),
    quantity: number(pp.quantity),
    unit: text(pp.unit),
    rate: number(pp.rate),
    notes: text(pp.notes),
  }
}

async function listProjects() {
  const items: ApiProject[] = []
  for (let skip = 0; skip < MAX_PROJECTS; skip += PAGE) {
    const page = await get<{ items: ApiProject[]; total: number }>(`/projects/?skip=${skip}&limit=${PAGE}&sort=newest`)
    items.push(...page.items)
    if (page.items.length < PAGE || items.length >= page.total) break
  }
  return { projects: items.map(summary) }
}

async function getProject(id: unknown) {
  if (typeof id !== 'string' || !UUID.test(id)) throw new Refusal('Which plants-app project?')
  const project = await get<ApiProject>(`/projects/${id}`)
  return { project: { ...summary(project), lines: (project.plants ?? []).map(line) } }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405)
  try {
    await checkCaller(req)
    const body = await req.json().catch(() => ({})) as { action?: string; id?: unknown }
    switch (body.action) {
      case 'list':
        return reply(await listProjects())
      case 'get':
        return reply(await getProject(body.id))
      default:
        throw new Refusal('Unknown action.')
    }
  } catch (e) {
    if (e instanceof Refusal) return reply({ error: e.message }, e.status)
    console.error(e)
    return reply({ error: 'Something went wrong reading the plants app.' }, 500)
  }
})
