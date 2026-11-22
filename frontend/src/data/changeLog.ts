import { DEMO_MODE, supabase } from '../lib/supabase'
import { COLLECTIONS } from './collections'
import type { DbShape } from './store'

/**
 * Settings → History: every record created, changed or deleted, by whom.
 *
 * Live, the database writes it (the change_log table, filled by triggers — see
 * supabase/migrations/20261122120000_history_and_remark_edits.sql), so nothing
 * the app does can skip or alter an entry. The demo keeps the same log in this
 * browser by comparing each save with the one before.
 */
export interface ChangeEntry {
  id: string
  /** ISO timestamp. */
  at: string
  /** The table, e.g. "projects", "project_messages". */
  collection: string
  recordId: string
  op: 'create' | 'update' | 'delete'
  /** Employee id; undefined for the system. */
  actor?: string
  /** create / delete: the record. update: { field: { from, to } }. */
  changes: Record<string, unknown>
}

export interface HistoryQuery {
  collection?: string
  actor?: string
  /** YYYY-MM-DD, inclusive. */
  from?: string
  to?: string
  /** The last entry already shown; the next page starts after it. */
  after?: ChangeEntry
  recordId?: string
}

export const HISTORY_PAGE = 100

export type HistoryResult =
  | { ok: true; entries: ChangeEntry[]; more: boolean }
  | { ok: false; reason: 'not-installed' | 'no-access' | 'error'; message?: string }

const endOfDay = (day: string) => new Date(`${day}T23:59:59.999`).toISOString()
const startOfDay = (day: string) => new Date(`${day}T00:00:00`).toISOString()

export async function fetchHistory(q: HistoryQuery): Promise<HistoryResult> {
  if (DEMO_MODE) {
    const log = readDemoLog()
    const start = q.after ? log.findIndex((e) => e.id === q.after!.id) + 1 : 0
    const all = log.slice(start).filter((e) =>
      (!q.collection || e.collection === q.collection)
      && (!q.actor || e.actor === q.actor)
      && (!q.recordId || e.recordId === q.recordId)
      && (!q.from || e.at >= startOfDay(q.from))
      && (!q.to || e.at <= endOfDay(q.to)))
    return { ok: true, entries: all.slice(0, HISTORY_PAGE), more: all.length > HISTORY_PAGE }
  }

  let query = supabase()
    .from('change_log')
    .select('id, at, collection, record_id, op, actor, changes')
    // Ids rise with every entry, so they page reliably even where one save wrote several at the same moment.
    .order('id', { ascending: false })
    .limit(HISTORY_PAGE + 1)
  if (q.collection) query = query.eq('collection', q.collection)
  if (q.actor) query = query.eq('actor', q.actor)
  if (q.recordId) query = query.eq('record_id', q.recordId)
  if (q.from) query = query.gte('at', startOfDay(q.from))
  if (q.to) query = query.lte('at', endOfDay(q.to))
  if (q.after) query = query.lt('id', Number(q.after.id))

  const { data, error, status } = await query
  if (error) {
    // PostgREST answers 404 / PGRST205 / 42P01 for a table the database does not have yet.
    if (status === 404 || error.code === 'PGRST205' || error.code === '42P01') return { ok: false, reason: 'not-installed' }
    if (status === 401 || status === 403 || error.code === '42501') return { ok: false, reason: 'no-access' }
    return { ok: false, reason: 'error', message: error.message }
  }
  const rows = (data ?? []) as { id: number; at: string; collection: string; record_id: string; op: ChangeEntry['op']; actor: string | null; changes: Record<string, unknown> }[]
  return {
    ok: true,
    more: rows.length > HISTORY_PAGE,
    entries: rows.slice(0, HISTORY_PAGE).map((r) => ({
      id: String(r.id), at: r.at, collection: r.collection, recordId: r.record_id, op: r.op,
      actor: r.actor ?? undefined, changes: r.changes ?? {},
    })),
  }
}

// ---------------------------------------------------------------- demo

const DEMO_LOG_KEY = 'landschaft-crm-demo-history'
const DEMO_SESSION_KEY = 'landschaft-crm-session'
const DEMO_LOG_MAX = 2000
/** Not history: read markers move every time a thread is opened. */
const SKIPPED = new Set(['chat_reads'])

function readDemoLog(): ChangeEntry[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_LOG_KEY) ?? '[]') as ChangeEntry[]
  } catch {
    return []
  }
}

/** Drops embedded images, as the database does, so the browser's storage is not filled with them. */
function trim<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null).replace(/"data:[^"]{200,}"/g, '"[image]"')) as T
}

type Baseline = Map<string, Map<string, string>>

function snapshot(db: DbShape): Baseline {
  return new Map(COLLECTIONS.map((spec) => [
    spec.table,
    new Map([...spec.rows(db)].map(([id, record]) => [id, JSON.stringify(record)])),
  ]))
}

/**
 * Starts the demo's log from what was just loaded, and returns the function
 * the demo calls after every save to record what that save changed.
 */
export function demoRecorder(db: DbShape): (db: DbShape) => void {
  let baseline = snapshot(db)
  return (next) => {
    const now = snapshot(next)
    const actor = (() => {
      try { return localStorage.getItem(DEMO_SESSION_KEY) ?? 'e1' } catch { return 'e1' }
    })()
    const at = new Date().toISOString()
    const fresh: ChangeEntry[] = []
    for (const [table, rows] of now) {
      if (SKIPPED.has(table)) continue
      const before = baseline.get(table) ?? new Map<string, string>()
      for (const [id, json] of rows) {
        const old = before.get(id)
        if (old === json) continue
        const entry = { id: crypto.randomUUID(), at, collection: table, recordId: id, actor }
        if (old === undefined) {
          fresh.push({ ...entry, op: 'create', changes: trim(JSON.parse(json)) })
        } else {
          const a = JSON.parse(old) as Record<string, unknown>
          const b = JSON.parse(json) as Record<string, unknown>
          const changes: Record<string, unknown> = {}
          for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
            if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) changes[key] = { from: a[key], to: b[key] }
          }
          if (Object.keys(changes).length) fresh.push({ ...entry, op: 'update', changes: trim(changes) })
        }
      }
      for (const [id, old] of before) {
        if (!rows.has(id)) fresh.push({ id: crypto.randomUUID(), at, collection: table, recordId: id, actor, op: 'delete', changes: trim(JSON.parse(old)) })
      }
    }
    baseline = now
    if (!fresh.length) return
    try {
      localStorage.setItem(DEMO_LOG_KEY, JSON.stringify([...fresh, ...readDemoLog()].slice(0, DEMO_LOG_MAX)))
    } catch {
      // A full browser store only costs the demo its history.
    }
  }
}

/** Clears the demo's history along with its data. */
export function clearDemoHistory() {
  try { localStorage.removeItem(DEMO_LOG_KEY) } catch { /* nothing to clear */ }
}
