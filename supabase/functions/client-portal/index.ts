// The client portal for Landschaft CRM: links a client opens without a login.
//
//   /portal/amc/<token>        their AMC visit reports — notes, issues, photos, documents
//   /portal/checklist/<token>  the landscape requirement checklist, to fill in and send
//
// The token is the secret in the link, set by the team on the maintenance
// contract (shareToken) or the project (briefToken) and cleared to switch the
// link off. This function holds the service role, so it hands out only what
// one link is for: no ids of staff, no money, nothing about other projects.
//
// Deployed with verify_jwt off — the people calling it have no login.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BUCKET = 'files'
const STORED = 'sb:'
/** Photos and documents on a report open for six hours; reopening the link renews them. */
const URL_SECONDS = 6 * 3600
const TOKEN_RULE = /^[A-Za-z0-9_-]{16,128}$/
const MAX_ANSWERS_BYTES = 64 * 1024

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

type Json = Record<string, unknown>

const GONE = 'This link is not active any more. Ask Landschaft for a new one.'

async function record<T>(table: string, id: unknown): Promise<T | null> {
  if (typeof id !== 'string' || !id) return null
  const { data, error } = await admin.from(table).select('data').eq('id', id).maybeSingle()
  if (error) throw error
  return (data?.data as T) ?? null
}

/** The one record whose link carries this token. */
async function byToken<T>(table: string, field: string, token: unknown): Promise<T> {
  if (typeof token !== 'string' || !TOKEN_RULE.test(token)) throw new Refusal(GONE, 404)
  const { data, error } = await admin.from(table).select('data').eq(`data->>${field}`, token).limit(1)
  if (error) throw error
  const found = data?.[0]?.data as T | undefined
  if (!found) throw new Refusal(GONE, 404)
  return found
}

/** Signed URLs for every stored file in one request. */
async function signAll(refs: string[]): Promise<Map<string, string>> {
  const paths = [...new Set(refs.filter((r) => r.startsWith(STORED)).map((r) => r.slice(STORED.length)))]
  if (!paths.length) return new Map()
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrls(paths, URL_SECONDS)
  if (error) throw error
  return new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [STORED + d.path, d.signedUrl]))
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')

// ---------------------------------------------------------------- AMC report

interface Visit {
  id: string
  date: string
  plannedFor?: string
  done: boolean
  notes?: string
  issues?: string[]
  photoCount?: number
  photos?: { id: string; src: string; caption?: string }[]
  files?: { name: string; file?: string; sizeKb: number }[]
}

async function amcReport(token: unknown) {
  const contract = await byToken<Json>('maintenance', 'shareToken', token)
  const project = await record<Json>('projects', contract.projectId)
  const client = await record<Json>('clients', project?.clientId)
  const visits = (Array.isArray(contract.visits) ? contract.visits : []) as Visit[]

  const urls = await signAll(visits.flatMap((v) => [
    ...(v.photos ?? []).map((p) => p.src),
    ...(v.files ?? []).map((f) => f.file ?? ''),
  ]))
  // A photo that was never uploaded (taken offline, still a data URL) is sent as it is.
  const shown = (ref?: string) => (ref?.startsWith(STORED) ? urls.get(ref) : ref)

  return {
    projectName: text(project?.name),
    siteLocation: text(project?.siteLocation),
    clientName: text(client?.name),
    // The contract as the client may see it: no team, no value, no token.
    record: {
      id: contract.id,
      projectId: contract.projectId,
      type: contract.type,
      startDate: contract.startDate,
      endDate: contract.endDate,
      scopeOfWork: text(contract.scopeOfWork),
      visitSchedule: '',
      schedule: contract.schedule,
      renewalDate: contract.renewalDate,
      teamIds: [],
      visits: visits.map((v) => ({
        id: v.id,
        date: v.date,
        plannedFor: v.plannedFor,
        done: Boolean(v.done),
        teamIds: [],
        notes: v.done ? text(v.notes) : '',
        issues: v.done && Array.isArray(v.issues) ? v.issues : [],
        photoCount: v.photoCount ?? 0,
        photos: v.done ? (v.photos ?? []).map((p) => ({ id: p.id, src: shown(p.src), caption: p.caption })).filter((p) => p.src) : [],
        files: v.done ? (v.files ?? []).map((f) => ({ name: f.name, file: shown(f.file), sizeKb: f.sizeKb })) : [],
      })),
    },
  }
}

// ---------------------------------------------------------------- requirement checklist

async function brief(token: unknown) {
  const project = await byToken<Json>('projects', 'briefToken', token)
  const client = await record<Json>('clients', project.clientId)
  const saved = await record<Json>('client_briefs', project.id)
  return {
    projectName: text(project.name),
    siteLocation: text(project.siteLocation),
    clientName: text(client?.name),
    clientPhone: text(client?.phone),
    brief: saved ? { answers: saved.answers ?? {}, submittedAt: saved.submittedAt, updatedAt: saved.updatedAt } : null,
  }
}

/**
 * Answers as the portal sends them: question keys to text or lists of text.
 * The questions themselves live in the app (frontend/src/domain/clientBrief.ts);
 * this keeps only the shape and the sizes in check.
 */
function cleanAnswers(value: unknown): Record<string, string | string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Refusal('The answers did not come through. Try again.')
  if (JSON.stringify(value).length > MAX_ANSWERS_BYTES) throw new Refusal('The answers are too long. Shorten the notes and try again.')
  const out: Record<string, string | string[]> = {}
  for (const [key, answer] of Object.entries(value).slice(0, 120)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(key)) continue
    if (typeof answer === 'string') {
      const t = answer.trim().slice(0, 4000)
      if (t) out[key] = t
    } else if (Array.isArray(answer)) {
      const items = answer.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 200)).filter(Boolean).slice(0, 40)
      if (items.length) out[key] = items
    }
  }
  return out
}

async function saveBrief(token: unknown, answers: unknown) {
  const project = await byToken<Json>('projects', 'briefToken', token)
  const id = String(project.id)
  const saved = await record<Json>('client_briefs', id)
  const now = new Date().toISOString()
  const data = {
    id,
    projectId: id,
    answers: cleanAnswers(answers),
    submittedAt: typeof saved?.submittedAt === 'string' ? saved.submittedAt : now,
    updatedAt: now,
  }
  const { error } = await admin.from('client_briefs').upsert({ id, data })
  if (error) throw error
  return { submittedAt: data.submittedAt, updatedAt: data.updatedAt }
}

// ---------------------------------------------------------------- serve

async function handle(req: Request): Promise<unknown> {
  const body = await req.json().catch(() => ({}))
  switch (body.action) {
    case 'amc':
      return amcReport(body.token)
    case 'brief':
      return brief(body.token)
    case 'brief-save':
      return saveBrief(body.token, body.answers)
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
    return reply({ error: 'Something went wrong on the server. Try again in a minute.' }, 500)
  }
})
