import { useSyncExternalStore } from 'react'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { hasPermission } from '../domain/roles'
import { COLLECTIONS, setCollection, specFor, type CollectionSpec, type Row } from './collections'
import { emptyDb, store, type CollectionKey } from './store'

/**
 * Keeps the in-memory store and Supabase in step for the signed-in person.
 *
 *  - On sign-in every collection is loaded, so pages keep reading the store
 *    synchronously as they always have.
 *  - A change marks the collections it went near. A moment later — once the
 *    typing stops — those are compared with what the server last had, and
 *    only the records that differ are queued. The queue is kept in this
 *    browser, so a foreman on a weak site connection loses nothing: it sends
 *    when the connection is back, even after the page is closed and reopened.
 *  - Other people's changes arrive over Realtime. After a dropped connection
 *    or a long time away everything is reloaded, keeping what is still queued.
 *
 * Two people editing the same record at once: the last save wins.
 */

const PAGE = 1000
const DEBOUNCE_MS = 600
const MAX_RETRY_MS = 60_000
/** Reload everything when the app comes back after this long in the background. */
const STALE_AFTER_MS = 5 * 60_000

// ---------------------------------------------------------------- status

export interface SyncStatus {
  state: 'saved' | 'saving' | 'offline' | 'error'
  /** Changes not yet on the server. */
  pending: number
  /** The last change the server refused, in words. */
  error?: string
}

let status: SyncStatus = { state: 'saved', pending: 0 }
const statusListeners = new Set<() => void>()

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next }
  statusListeners.forEach((fn) => fn())
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (fn) => {
      statusListeners.add(fn)
      return () => statusListeners.delete(fn)
    },
    () => status,
  )
}

export function dismissSyncError() {
  setStatus({ error: undefined, state: session?.outbox.size ? status.state : 'saved' })
}

// ---------------------------------------------------------------- session

/** One change waiting to be sent: the record as JSON, or null to delete it. */
interface Pending {
  table: string
  id: string
  json: string | null
  /** Bumped when the same record changes again while it is being sent. */
  v: number
}

interface Session {
  userId: string
  employeeId: string
  /** What the server holds, by table then id, as JSON. */
  baseline: Map<string, Map<string, string>>
  /** Settings exactly as the server last had them — see settingsPayload(). */
  serverSettings: unknown
  /** Collections changed since they were last compared with the baseline. */
  dirty: Set<CollectionKey>
  outbox: Map<string, Pending>
  channel: RealtimeChannel | null
  flushing: boolean
  timer?: ReturnType<typeof setTimeout>
  retryMs: number
  disconnected: boolean
  hiddenAt?: number
  cleanup: () => void
}

let session: Session | null = null

const tableSpecs = new Map(COLLECTIONS.map((spec) => [spec.table, spec]))
const outboxKey = (userId: string) => `landschaft-crm-outbox:${userId}`
const entryKey = (table: string, id: string) => `${table}\n${id}`

/**
 * A record as JSON, for telling whether it changed. Key order can differ from
 * the server's copy, which at worst sends a record that did not change.
 */
const toJson = (value: unknown) => JSON.stringify(value)

function saveOutbox() {
  if (!session) return
  try {
    if (session.outbox.size) localStorage.setItem(outboxKey(session.userId), JSON.stringify([...session.outbox.values()]))
    else localStorage.removeItem(outboxKey(session.userId))
  } catch {
    // Storage full or blocked: the queue still lives in memory until it is sent.
  }
  setStatus({ pending: session.outbox.size })
}

function restoreOutbox(userId: string): Map<string, Pending> {
  try {
    const saved = JSON.parse(localStorage.getItem(outboxKey(userId)) ?? '[]') as Pending[]
    return new Map(saved.filter((p) => tableSpecs.has(p.table)).map((p) => [entryKey(p.table, p.id), p]))
  } catch {
    return new Map()
  }
}

// ---------------------------------------------------------------- loading

async function fetchAll(table: string): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase()
      .from(table).select('id, data').order('created_at').order('id').range(from, from + PAGE - 1)
    if (error) throw new Error(`Could not load ${table.replace(/_/g, ' ')}: ${error.message}`)
    rows.push(...(data as Row[]))
    if (data.length < PAGE) return rows
  }
}

const fetchEverything = () => Promise.all(COLLECTIONS.map((spec) => fetchAll(spec.table)))

/** Builds the store from what the server sent, with this browser's unsent changes laid on top. */
function build(results: Row[][], outbox: Map<string, Pending>) {
  const db = emptyDb()
  const baseline = new Map<string, Map<string, string>>()
  COLLECTIONS.forEach((spec, i) => {
    setCollection(db, spec, spec.build(results[i]))
    // Taken from the built collection, so tidying on load (settings defaults) is not a change.
    baseline.set(spec.table, new Map([...spec.rows(db)].map(([id, data]) => [id, toJson(data)])))
  })
  const settingsRow = results[COLLECTIONS.findIndex((spec) => spec.key === 'settings')].find((r) => r.id === 'main')

  for (const pending of outbox.values()) {
    const spec = tableSpecs.get(pending.table)!
    spec.put(db, pending.id, pending.json === null ? null : JSON.parse(pending.json))
    const base = baseline.get(pending.table)!
    if (pending.json === null) base.delete(pending.id)
    else base.set(pending.id, toJson(spec.rows(db).get(pending.id)))
  }
  return { db, baseline, serverSettings: settingsRow?.data ?? null }
}

// ---------------------------------------------------------------- saving

/** Notes what a change went near; it is compared once the edits pause. */
function persist(touched: ReadonlySet<CollectionKey>) {
  if (!session) return
  for (const key of touched) if (specFor(key)) session.dirty.add(key)
  schedule(DEBOUNCE_MS)
}

/** Compares the changed collections with the server's copy and queues the records that differ. */
function diffDirty() {
  if (!session || session.dirty.size === 0) return
  const db = store.db
  let queued = false
  for (const key of session.dirty) {
    const spec = specFor(key)
    const base = session.baseline.get(spec.table)!
    const current = spec.rows(db)
    for (const [id, data] of current) {
      const json = toJson(data)
      if (base.get(id) !== json) {
        base.set(id, json)
        enqueue(spec.table, id, json)
        queued = true
      }
    }
    for (const id of [...base.keys()]) {
      if (!current.has(id)) {
        base.delete(id)
        enqueue(spec.table, id, null)
        queued = true
      }
    }
  }
  session.dirty.clear()
  if (queued) saveOutbox()
}

function enqueue(table: string, id: string, json: string | null) {
  if (!session) return
  const key = entryKey(table, id)
  const v = (session.outbox.get(key)?.v ?? 0) + 1
  session.outbox.set(key, { table, id, json, v })
}

function schedule(ms: number) {
  if (!session) return
  clearTimeout(session.timer)
  session.timer = setTimeout(() => void flush(), ms)
}

/**
 * What is sent for the settings row. Someone without Settings edit may only
 * change worker skills and holidays (the database enforces this), so their
 * save carries those two onto the server's own copy and nothing else.
 */
function settingsPayload(data: Record<string, unknown>): unknown {
  if (!session) return data
  const me = store.db.employees.find((e) => e.id === session!.employeeId)
  const server = session.serverSettings as Record<string, unknown> | null
  if (!me || !server || hasPermission(store.db.settings.permissions, me.role, 'Settings', 'edit')) return data
  return { ...server, workerSkills: data.workerSkills, holidays: data.holidays }
}

/** A refusal that sending again will not fix, as opposed to a dropped connection. */
function isPermanent(code: number): boolean {
  return code >= 400 && code < 500 && code !== 401 && code !== 408 && code !== 429
}

class SendError extends Error {
  readonly permanent: boolean
  constructor(message: string, permanent: boolean) {
    super(message)
    this.permanent = permanent
  }
}

async function send(table: string, items: Pending[]): Promise<void> {
  const upserts = items.filter((p) => p.json !== null)
  const deletes = items.filter((p) => p.json === null)
  if (upserts.length) {
    const rows = upserts.map((p) => {
      const data = JSON.parse(p.json!) as Record<string, unknown>
      return { id: p.id, data: table === 'settings' ? settingsPayload(data) : data }
    })
    const { error, status: code } = await supabase().from(table).upsert(rows)
    if (error) throw new SendError(error.message, isPermanent(code))
    if (table === 'settings' && session) session.serverSettings = rows[0].data
  }
  if (deletes.length) {
    const { error, status: code } = await supabase().from(table).delete().in('id', deletes.map((p) => p.id))
    if (error) throw new SendError(error.message, isPermanent(code))
  }
}

async function fetchRow(table: string, id: string): Promise<unknown> {
  const { data, error } = await supabase().from(table).select('id, data').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Row | null)?.data ?? null
}

/** Drops a change the server refused and shows the server's copy again. */
async function revert(pending: Pending) {
  const spec = tableSpecs.get(pending.table)!
  try {
    const data = await fetchRow(pending.table, pending.id)
    applyRemote(spec, pending.id, data)
  } catch {
    // The next reload puts it right.
  }
}

function done(items: Pending[]) {
  if (!session) return
  for (const item of items) {
    const key = entryKey(item.table, item.id)
    // Changed again while it was on its way: keep the newer one queued.
    if (session.outbox.get(key)?.v === item.v) session.outbox.delete(key)
  }
}

/** A friendlier line for the errors people are likely to meet. */
function explain(message: string): string {
  if (/row-level security|permission denied|42501/i.test(message)) return 'You do not have permission to make that change.'
  return message
}

async function flush(): Promise<void> {
  if (!session || session.flushing) return
  diffDirty()
  if (session.outbox.size === 0) {
    setStatus({ state: status.error ? 'error' : 'saved' })
    return
  }
  if (!navigator.onLine) {
    setStatus({ state: 'offline' })
    return
  }
  const current = session
  current.flushing = true
  setStatus({ state: 'saving' })
  const byTable = new Map<string, Pending[]>()
  for (const p of current.outbox.values()) byTable.set(p.table, [...(byTable.get(p.table) ?? []), p])

  let offline = false
  let refused: string | undefined
  for (const [table, items] of byTable) {
    try {
      await send(table, items)
      done(items)
    } catch (e) {
      if (!(e instanceof SendError) || !e.permanent) {
        offline = true
        break
      }
      // One refused record should not hold back the rest: send them one at a time.
      for (const item of items) {
        try {
          await send(table, [item])
          done([item])
        } catch (single) {
          if (single instanceof SendError && single.permanent) {
            done([item])
            refused = explain(single.message)
            void revert(item)
          } else {
            offline = true
          }
        }
      }
      if (offline) break
    }
  }

  current.flushing = false
  if (session !== current) return
  saveOutbox()
  if (offline) {
    setStatus({ state: 'offline' })
    schedule(current.retryMs)
    current.retryMs = Math.min(current.retryMs * 2, MAX_RETRY_MS)
    return
  }
  current.retryMs = 2000
  setStatus({ state: refused ? 'error' : current.outbox.size ? 'saving' : 'saved', error: refused ?? status.error })
  // Anything changed while this batch was on its way goes next.
  if (current.outbox.size || current.dirty.size) schedule(0)
}

// ---------------------------------------------------------------- receiving

function applyRemote(spec: CollectionSpec, id: string, data: unknown) {
  if (!session) return
  const base = session.baseline.get(spec.table)!
  if (data === null) {
    if (!base.has(id)) return
    base.delete(id)
    store.apply((db) => spec.put(db, id, null))
    return
  }
  if (spec.key === 'settings') session.serverSettings = data
  store.apply((db) => spec.put(db, id, data))
  // Compared against what the store now holds, so a later edit diffs correctly.
  base.set(id, toJson(spec.rows(store.db).get(id)))
}

function onChange(spec: CollectionSpec, payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>) {
  if (!session) return
  const deleted = payload.eventType === 'DELETE'
  const row = (deleted ? payload.old : payload.new) as Partial<Row>
  if (!row.id) return
  const id = row.id
  // Edits here not yet compared go into the queue first, so they are not overwritten.
  if (session.dirty.has(spec.key)) diffDirty()
  // Our own copy is newer and still on its way.
  if (session.outbox.has(entryKey(spec.table, id))) return
  if (deleted) return applyRemote(spec, id, null)
  // Realtime leaves out very large records; fetch those directly.
  if (row.data === undefined) {
    void fetchRow(spec.table, id).then((data) => {
      if (session && !session.outbox.has(entryKey(spec.table, id))) applyRemote(spec, id, data)
    }, () => undefined)
    return
  }
  if (session.baseline.get(spec.table)!.get(id) === toJson(row.data)) return
  applyRemote(spec, id, row.data)
}

/** Reloads everything, keeping unsent changes — after a dropped connection or a long time away. */
async function resync() {
  const current = session
  if (!current) return
  try {
    const results = await fetchEverything()
    if (session !== current) return
    // Edits made while loading join the queue before the store is replaced.
    diffDirty()
    const loaded = build(results, current.outbox)
    current.baseline = loaded.baseline
    current.serverSettings = loaded.serverSettings
    store.load(loaded.db)
    void flush()
  } catch {
    setStatus({ state: 'offline' })
  }
}

function subscribe(current: Session) {
  const channel = supabase().channel('crm-db')
  for (const spec of COLLECTIONS) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: spec.table }, (payload) => onChange(spec, payload))
  }
  channel.subscribe((state) => {
    if (session !== current) return
    if (state === 'SUBSCRIBED') {
      if (current.disconnected) {
        current.disconnected = false
        void resync()
      }
    } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
      current.disconnected = true
    }
  })
  return channel
}

// ---------------------------------------------------------------- open / close

/**
 * Loads the signed-in person's data and starts keeping it in step. The first
 * Super Admin or CEO to sign in on a new database also saves the default
 * settings, including the permission matrix the database checks against.
 */
export async function openSession(userId: string, employeeId: string): Promise<void> {
  await closeSession()
  const outbox = restoreOutbox(userId)
  const loaded = build(await fetchEverything(), outbox)

  const onOnline = () => void flush()
  const onOffline = () => setStatus({ state: 'offline' })
  // Leaving or hiding the page: queue anything not yet compared, so it survives a closed tab.
  const onHide = () => {
    diffDirty()
    saveOutbox()
  }
  const onVisibility = () => {
    if (!session) return
    if (document.hidden) {
      session.hiddenAt = Date.now()
      onHide()
    } else if (session.hiddenAt && Date.now() - session.hiddenAt > STALE_AFTER_MS) {
      session.hiddenAt = undefined
      void resync()
    }
  }
  const onUnload = (e: BeforeUnloadEvent) => {
    onHide()
    if (session?.outbox.size) e.preventDefault()
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('beforeunload', onUnload)

  const current: Session = {
    userId, employeeId,
    baseline: loaded.baseline,
    serverSettings: loaded.serverSettings,
    dirty: new Set(),
    outbox,
    channel: null,
    flushing: false,
    retryMs: 2000,
    disconnected: false,
    cleanup: () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onUnload)
    },
  }
  session = current
  store.load(loaded.db)
  store.setPersister(persist)
  setStatus({ state: outbox.size ? 'saving' : 'saved', pending: outbox.size, error: undefined })

  const me = loaded.db.employees.find((e) => e.id === employeeId)
  if (!loaded.serverSettings && (me?.role === 'super_admin' || me?.role === 'ceo')) {
    current.baseline.get('settings')!.delete('main')
    current.dirty.add('settings')
  }

  current.channel = subscribe(current)
  void flush()
}

/** Stops syncing and clears the data from memory. Unsent changes stay queued in this browser. */
export async function closeSession(): Promise<void> {
  const current = session
  if (!current) return
  diffDirty()
  saveOutbox()
  session = null
  clearTimeout(current.timer)
  current.cleanup()
  store.setPersister(null)
  store.load(emptyDb())
  setStatus({ state: 'saved', pending: 0, error: undefined })
  if (current.channel) await supabase().removeChannel(current.channel)
}

/** Sends anything still queued, as far as the connection allows. Used before signing out. */
export async function flushNow(): Promise<number> {
  if (!session) return 0
  clearTimeout(session.timer)
  await flush()
  return session?.outbox.size ?? 0
}
