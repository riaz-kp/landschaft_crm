import { useSyncExternalStore } from 'react'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { isNetworkError, supabase } from '../lib/supabase'
import { hasPermission } from '../domain/roles'
import { COLLECTIONS, setCollection, specFor, type CollectionSpec, type Row } from './collections'
import { uploadPhoto } from './files'
import { local } from './local'
import { emptyDb, store, type CollectionKey } from './store'

/**
 * Keeps the in-memory store and Supabase in step for the signed-in person.
 *
 *  - On sign-in every collection is loaded, so pages keep reading the store
 *    synchronously as they always have. A copy is kept on this device, so with
 *    no connection the app still opens on what it last loaded, for up to a week.
 *  - A change marks the collections it went near. A moment later — once the
 *    typing stops — those are compared with what the server last had, and
 *    only the records that differ are queued. The queue is kept in this
 *    browser, so a foreman on a weak site connection loses nothing: it sends
 *    when the connection is back, even after the page is closed and reopened.
 *  - Only the fields a person changed are sent, and the database lays them on
 *    the copy it holds (save_records). Someone else's change to other fields
 *    of the same record stays; a record deleted meanwhile stays deleted.
 *  - A photo taken offline rides on its record as a data URL and is uploaded
 *    just before the record is sent.
 *  - Other people's changes arrive over Realtime. After a dropped connection
 *    or a long time away everything is reloaded, keeping what is still queued.
 *
 * Two people changing the same field of the same record: the last save wins.
 */

const PAGE = 1000
const DEBOUNCE_MS = 600
const MAX_RETRY_MS = 60_000
/** Reload everything when the app comes back after this long in the background. */
const STALE_AFTER_MS = 5 * 60_000
/** How long the copy on this device may be opened without reaching the server. */
const OFFLINE_COPY_MS = 7 * 24 * 60 * 60_000
/** The copy on this device is rewritten this long after the last change, not on every keystroke. */
const SNAPSHOT_DELAY_MS = 5000

// ---------------------------------------------------------------- status

export interface SyncStatus {
  state: 'saved' | 'saving' | 'offline' | 'error'
  /** Changes not yet on the server. */
  pending: number
  /** The last change the server refused, in words. */
  error?: string
  /** Opened with no connection: when the data on screen was last loaded from the server. */
  savedCopyFrom?: number
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
  /**
   * The record as the server had it when this change began, which the change
   * is measured against; null for a record made here. Missing on changes queued
   * by a version of the app from before, which are sent whole.
   */
  base?: string | null
  /** Bumped when the same record changes again while it is being sent. */
  v: number
}

interface Session {
  userId: string
  employeeId: string
  /** What the server holds, by table then id, as JSON. */
  baseline: Map<string, Map<string, string>>
  /** Collections changed since they were last compared with the baseline. */
  dirty: Set<CollectionKey>
  outbox: Map<string, Pending>
  channel: RealtimeChannel | null
  flushing: boolean
  timer?: ReturnType<typeof setTimeout>
  retryMs: number
  disconnected: boolean
  hiddenAt?: number
  /** Opened on the copy kept on this device; everything is reloaded once the server answers. */
  fromDevice: boolean
  resyncing: boolean
  /** When everything was last loaded from the server. */
  syncedAt: number
  /** False once the copy on this device is being forgotten (signing out), so it is not written again. */
  keepCopy: boolean
  snapshotTimer?: ReturnType<typeof setTimeout>
  cleanup: () => void
}

let session: Session | null = null

const tableSpecs = new Map(COLLECTIONS.map((spec) => [spec.table, spec]))
const entryKey = (table: string, id: string) => `${table}\n${id}`

/**
 * A record as JSON, for telling whether it changed. Key order can differ from
 * the server's copy, which at worst sends a field that did not change.
 */
const toJson = (value: unknown) => JSON.stringify(value)

/** JSON with every object's keys sorted: the database hands records back in its own key order. */
const stableJson = (value: unknown) => JSON.stringify(value, (_key, v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : v)

// ---------------------------------------------------------------- kept on this device

/** Where the queue is kept, in IndexedDB. */
const outboxKey = (userId: string) => `outbox:${userId}`
/** Where the queue was kept before, in localStorage; still read, and used when IndexedDB is unavailable. */
const legacyOutboxKey = (userId: string) => `landschaft-crm-outbox:${userId}`
const SNAPSHOT_KEY = 'snapshot'
const SNAPSHOT_FORMAT = 1

/** The copy of the data kept on this device, for opening with no connection. One person's at a time. */
interface Snapshot {
  format: number
  userId: string
  employeeId: string
  /** When it was last loaded in full from the server. */
  syncedAt: number
  /** Each table's records as [id, JSON], in the order `build` takes them. */
  tables: Record<string, [string, string][]>
}

/** Writes to this device in turn, so an older copy never lands on top of a newer one. */
let writes: Promise<void> = Promise.resolve()
function write(task: () => Promise<void>) {
  writes = writes.then(task).catch((e: unknown) => console.warn('Could not keep data on this device', e))
}

function saveOutbox() {
  if (!session) return
  const userId = session.userId
  const entries = [...session.outbox.values()].map((pending) => ({ ...pending }))
  write(async () => {
    try {
      if (entries.length) await local.set(outboxKey(userId), entries)
      else await local.delete(outboxKey(userId))
      localStorage.removeItem(legacyOutboxKey(userId))
    } catch {
      // No IndexedDB here (some private windows): localStorage as before, while it fits.
      try {
        if (entries.length) localStorage.setItem(legacyOutboxKey(userId), JSON.stringify(entries))
        else localStorage.removeItem(legacyOutboxKey(userId))
      } catch {
        // Full or blocked: the queue still lives in memory until it is sent.
      }
    }
  })
  setStatus({ pending: session.outbox.size })
}

async function restoreOutbox(userId: string): Promise<Map<string, Pending>> {
  // A queue saved a moment ago (closing the last session) lands before it is read back.
  await writes
  const saved: Pending[] = []
  try {
    saved.push(...((await local.get<Pending[]>(outboxKey(userId))) ?? []))
  } catch {
    // No IndexedDB: only what localStorage holds.
  }
  try {
    saved.push(...(JSON.parse(localStorage.getItem(legacyOutboxKey(userId)) ?? '[]') as Pending[]))
  } catch {
    // Unreadable: nothing was kept there.
  }
  const outbox = new Map<string, Pending>()
  for (const pending of saved) {
    const key = entryKey(pending.table, pending.id)
    if (tableSpecs.has(pending.table) && !outbox.has(key)) outbox.set(key, pending)
  }
  return outbox
}

function scheduleSnapshot() {
  if (!session?.keepCopy) return
  clearTimeout(session.snapshotTimer)
  session.snapshotTimer = setTimeout(saveSnapshot, SNAPSHOT_DELAY_MS)
}

/** Writes the copy on this device: the data as the server has it, with what is queued. */
function saveSnapshot() {
  const current = session
  if (!current?.keepCopy) return
  // Edits not yet compared join the queue first, so the copy and the queue agree.
  diffDirty()
  clearTimeout(current.snapshotTimer)
  current.snapshotTimer = undefined
  const tables: Snapshot['tables'] = {}
  for (const spec of COLLECTIONS) {
    const base = current.baseline.get(spec.table)!
    const rows = [...spec.rows(store.db)].map(([id, data]): [string, string] => [id, base.get(id) ?? toJson(data)])
    tables[spec.table] = spec.newestFirst ? rows.reverse() : rows
  }
  const snapshot: Snapshot = {
    format: SNAPSHOT_FORMAT, userId: current.userId, employeeId: current.employeeId, syncedAt: current.syncedAt, tables,
  }
  write(() => local.set(SNAPSHOT_KEY, snapshot))
}

async function readSnapshot(userId: string): Promise<Snapshot | null> {
  await writes
  const saved = await local.get<Snapshot>(SNAPSHOT_KEY).catch(() => undefined)
  if (!saved || saved.format !== SNAPSHOT_FORMAT || saved.userId !== userId) return null
  if (Date.now() - saved.syncedAt > OFFLINE_COPY_MS) {
    write(() => local.delete(SNAPSHOT_KEY))
    return null
  }
  return saved
}

const rowsOf = (snapshot: Snapshot): Row[][] =>
  COLLECTIONS.map((spec) => (snapshot.tables[spec.table] ?? []).map(([id, json]) => ({ id, data: JSON.parse(json) as unknown })))

/** Whom a login opens as from the copy on this device, when there is a recent one for them. */
export async function offlineCopyFor(userId: string): Promise<string | null> {
  return (await readSnapshot(userId))?.employeeId ?? null
}

/** Removes the copy of the data kept on this device: on signing out, or when access ends. */
export async function forgetOfflineCopy(): Promise<void> {
  if (session) {
    session.keepCopy = false
    clearTimeout(session.snapshotTimer)
  }
  write(() => local.delete(SNAPSHOT_KEY))
  await writes
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

  for (const pending of outbox.values()) {
    const spec = tableSpecs.get(pending.table)!
    spec.put(db, pending.id, pending.json === null ? null : JSON.parse(pending.json))
    const base = baseline.get(pending.table)!
    if (pending.json === null) base.delete(pending.id)
    else base.set(pending.id, toJson(spec.rows(db).get(pending.id)))
  }
  return { db, baseline }
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
      const before = base.get(id)
      if (before !== json) {
        base.set(id, json)
        enqueue(spec.table, id, json, before ?? null)
        queued = true
      }
    }
    for (const id of [...base.keys()]) {
      if (!current.has(id)) {
        base.delete(id)
        enqueue(spec.table, id, null, null)
        queued = true
      }
    }
  }
  session.dirty.clear()
  if (queued) {
    saveOutbox()
    scheduleSnapshot()
  }
}

function enqueue(table: string, id: string, json: string | null, before: string | null) {
  if (!session) return
  const key = entryKey(table, id)
  const queued = session.outbox.get(key)
  // Already waiting: the server has none of these changes yet, so they are measured from the same copy.
  session.outbox.set(key, { table, id, json, base: queued ? queued.base : before, v: (queued?.v ?? 0) + 1 })
}

function schedule(ms: number) {
  if (!session) return
  clearTimeout(session.timer)
  session.timer = setTimeout(() => void flush(), ms)
}

/** What is sent for one record: the fields that changed, or all of it when it is new. */
interface Change {
  id: string
  set: Record<string, unknown>
  unset?: string[]
  create?: true
}

/** What the server answers for each record sent. */
interface Saved {
  id: string
  status: 'saved' | 'gone'
  data: unknown
}

/** Settings fields anyone in the office may change; the rest needs Settings edit (the database enforces it). */
const OPEN_SETTINGS = ['workerSkills', 'holidays']

function mayEditSettings(): boolean {
  if (!session) return false
  const me = store.db.employees.find((e) => e.id === session!.employeeId)
  return Boolean(me && hasPermission(store.db.settings.permissions, me.role, 'Settings', 'edit'))
}

/** The change to send for a queued record, or null when nothing in it differs from the server's copy. */
function changeOf(pending: Pending): Change | null {
  const next = JSON.parse(pending.json!) as Record<string, unknown>
  let change: Change
  if (pending.base === null || (pending.base === undefined && pending.table !== 'settings')) {
    change = { id: pending.id, set: next, create: true }
  } else {
    const before = (pending.base === undefined ? {} : JSON.parse(pending.base)) as Record<string, unknown>
    const set = Object.fromEntries(Object.entries(next).filter(([field, value]) => toJson(value) !== toJson(before[field])))
    const unset = Object.keys(before).filter((field) => !(field in next))
    change = { id: pending.id, set, ...(unset.length ? { unset } : {}) }
  }
  // Someone without Settings edit sends only what they may change, so the rest is not refused with it.
  if (pending.table === 'settings' && !change.create && !mayEditSettings()) {
    change.set = Object.fromEntries(Object.entries(change.set).filter(([field]) => OPEN_SETTINGS.includes(field)))
    change.unset = change.unset?.filter((field) => OPEN_SETTINGS.includes(field))
  }
  return change.create || Object.keys(change.set).length || change.unset?.length ? change : null
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

/** A photo kept on a record as a data URL: one taken with no connection. */
const INLINE_PHOTO = /"(data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+)"/g
/** The folder each table's photos go to, as when they are uploaded straight away. */
const PHOTO_FOLDERS: Record<string, string> = { reports: 'reports', project_messages: 'remarks', employees: 'profiles', maintenance: 'amc' }

/**
 * Uploads the photos a change carries as data URLs and points the record at
 * the stored files instead, so the database never holds the photo itself.
 * A connection too weak for the upload holds the record back; a refused upload
 * sends the photo inside the record as before, so one bad file cannot block the queue.
 */
async function uploadPhotos(table: string, items: Pending[]) {
  for (const item of items) {
    const change = changeOf(item)
    if (!change) continue
    const photos = new Set([...toJson(change.set).matchAll(INLINE_PHOTO)].map((match) => match[1]))
    for (const dataUrl of photos) {
      let ref: string
      try {
        ref = await uploadPhoto(dataUrl, PHOTO_FOLDERS[table] ?? table)
      } catch (e) {
        if (isNetworkError(e)) throw new SendError('No connection for a photo upload', false)
        console.warn('Photo upload refused; it is sent inside the record instead', e)
        continue
      }
      replacePhoto(item, dataUrl, ref)
    }
  }
}

/** Swaps an uploaded photo's data URL for its reference: in the queue, the baseline and the store alike. */
function replacePhoto(item: Pending, dataUrl: string, ref: string) {
  if (!session) return
  const swap = (json: string) => json.split(`"${dataUrl}"`).join(`"${ref}"`)
  for (const pending of new Set([item, session.outbox.get(entryKey(item.table, item.id))])) {
    if (!pending) continue
    if (pending.json) pending.json = swap(pending.json)
    if (pending.base) pending.base = swap(pending.base)
  }
  const base = session.baseline.get(item.table)!
  const held = base.get(item.id)
  if (held) base.set(item.id, swap(held))
  const spec = tableSpecs.get(item.table)!
  const record = spec.rows(store.db).get(item.id)
  const json = record === undefined ? '' : toJson(record)
  if (json.includes(dataUrl)) store.apply((db) => spec.put(db, item.id, JSON.parse(swap(json))))
  saveOutbox()
  scheduleSnapshot()
}

/** False once the database turns out not to have save_records (migration 20261031120000 not yet run). */
let mergeOnServer = true

async function saveChanges(table: string, changes: Change[]): Promise<Saved[]> {
  if (mergeOnServer) {
    const { data, error, status: code } = await supabase().rpc('save_records', { p_table: table, p_records: changes })
    if (!error) return data as Saved[]
    if (error.code !== 'PGRST202') throw new SendError(error.message, isPermanent(code))
    mergeOnServer = false
  }
  return mergeHere(table, changes)
}

/**
 * The same merge done here, for a database without save_records: read each
 * record, lay the changed fields on it and write it back. Not one step like the
 * database function, so it only bridges the time until the migration is run.
 */
async function mergeHere(table: string, changes: Change[]): Promise<Saved[]> {
  const { data, error, status: code } = await supabase().from(table).select('id, data').in('id', changes.map((c) => c.id))
  if (error) throw new SendError(error.message, isPermanent(code))
  const held = new Map((data as Row[]).map((row) => [row.id, row.data as Record<string, unknown>]))
  const saved: Saved[] = []
  const rows: Row[] = []
  for (const change of changes) {
    const current = held.get(change.id)
    if (!current && !change.create) {
      saved.push({ id: change.id, status: 'gone', data: null })
      continue
    }
    const merged = { ...current }
    for (const field of change.unset ?? []) delete merged[field]
    Object.assign(merged, change.set)
    rows.push({ id: change.id, data: merged })
    saved.push({ id: change.id, status: 'saved', data: merged })
  }
  if (rows.length) {
    const { error: writeError, status: writeCode } = await supabase().from(table).upsert(rows)
    if (writeError) throw new SendError(writeError.message, isPermanent(writeCode))
  }
  return saved
}

/** Sends one table's queued records, and returns what the server now holds for those saved. */
async function send(table: string, items: Pending[]): Promise<Saved[]> {
  const saves = items.filter((p) => p.json !== null)
  const deletes = items.filter((p) => p.json === null)
  let saved: Saved[] = []
  if (saves.length) {
    await uploadPhotos(table, saves)
    const changes = saves.map(changeOf).filter((change): change is Change => change !== null)
    if (changes.length) saved = await saveChanges(table, changes)
  }
  if (deletes.length) {
    const { error, status: code } = await supabase().from(table).delete().in('id', deletes.map((p) => p.id))
    if (error) throw new SendError(error.message, isPermanent(code))
  }
  return saved
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

/**
 * Clears what was sent from the queue and takes in the server's copy, which
 * may also hold changes others made to other fields. Returns a description of
 * each record that turned out to have been deleted.
 */
function settle(items: Pending[], saved: Saved[]): string[] {
  if (!session) return []
  const results = new Map(saved.map((result) => [result.id, result]))
  const gone: string[] = []
  for (const item of items) {
    const result = results.get(item.id)
    if (result?.status === 'gone') {
      gone.push(forget(item))
      continue
    }
    const key = entryKey(item.table, item.id)
    const queued = session.outbox.get(key)
    if (queued?.v === item.v) {
      session.outbox.delete(key)
      if (result) adopt(item.table, item.id, result.data)
    } else if (queued && item.json !== null) {
      // Changed again while this was on its way: the next send is measured from what this one sent.
      queued.base = item.json
    }
  }
  return gone
}

/** Takes the server's copy of a record just saved, unless a newer one is waiting here. */
function adopt(table: string, id: string, data: unknown) {
  if (!session) return
  const spec = tableSpecs.get(table)!
  // Edits here not yet compared go into the queue first, so they are not overwritten.
  if (session.dirty.has(spec.key)) diffDirty()
  if (session.outbox.has(entryKey(table, id)) || matchesBaseline(table, id, data)) return
  applyRemote(spec, id, data)
}

const NOUNS: Record<string, string> = {
  projects: 'project', clients: 'client', leads: 'lead', tasks: 'task', reports: 'daily report', issues: 'issue',
  site_visits: 'site visit', quotations: 'quotation', maintenance: 'AMC contract', documents: 'document',
  employees: 'employee', workers: 'worker', payments: 'payment', payment_requests: 'payment request',
  consultations: 'consultation', calendar_events: 'calendar event', attendance: 'attendance entry', reminders: 'reminder',
}

/** Drops a record someone deleted while changes to it waited here, and says which it was. */
function forget(item: Pending): string {
  const spec = tableSpecs.get(item.table)!
  if (session!.dirty.has(spec.key)) diffDirty()
  session!.outbox.delete(entryKey(item.table, item.id))
  const record = spec.rows(store.db).get(item.id) as Record<string, unknown> | undefined
  applyRemote(spec, item.id, null)
  const name = [record?.name, record?.title].find((value): value is string => typeof value === 'string' && value.trim() !== '')
  return `${NOUNS[item.table] ?? 'record'}${name ? ` “${name}”` : ''}`
}

function deletedMeanwhile(what: string[]): string {
  return what.length === 1
    ? `the ${what[0]} was deleted by someone else while your changes waited.`
    : `${what.length} records were deleted by someone else while your changes waited.`
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
  const gone: string[] = []
  for (const [table, items] of byTable) {
    try {
      gone.push(...settle(items, await send(table, items)))
    } catch (e) {
      if (!(e instanceof SendError) || !e.permanent) {
        offline = true
        break
      }
      // One refused record should not hold back the rest: send them one at a time.
      for (const item of items) {
        try {
          gone.push(...settle([item], await send(table, [item])))
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
  if (gone.length) refused = deletedMeanwhile(gone)

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

/** Whether the server's copy says the same as the baseline, whatever order its keys come in. */
function matchesBaseline(table: string, id: string, data: unknown): boolean {
  const held = session?.baseline.get(table)?.get(id)
  return held !== undefined && stableJson(JSON.parse(held)) === stableJson(data)
}

function applyRemote(spec: CollectionSpec, id: string, data: unknown) {
  if (!session) return
  const base = session.baseline.get(spec.table)!
  if (data === null) {
    if (!base.has(id)) return
    base.delete(id)
    store.apply((db) => spec.put(db, id, null))
    scheduleSnapshot()
    return
  }
  store.apply((db) => spec.put(db, id, data))
  // Compared against what the store now holds, so a later edit diffs correctly.
  base.set(id, toJson(spec.rows(store.db).get(id)))
  scheduleSnapshot()
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
  if (matchesBaseline(spec.table, id, row.data)) return
  applyRemote(spec, id, row.data)
}

/** Reloads everything, keeping unsent changes — after a dropped connection, a long time away, or opening offline. */
async function resync() {
  const current = session
  if (!current || current.resyncing) return
  current.resyncing = true
  try {
    const results = await fetchEverything()
    if (session !== current) return
    // Edits made while loading join the queue before the store is replaced.
    diffDirty()
    const loaded = build(results, current.outbox)
    current.baseline = loaded.baseline
    current.syncedAt = Date.now()
    current.fromDevice = false
    store.load(loaded.db)
    setStatus({ savedCopyFrom: undefined })
    saveSnapshot()
    void flush()
  } catch {
    if (session === current) setStatus({ state: 'offline' })
  } finally {
    current.resyncing = false
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
 * Loads the signed-in person's data and starts keeping it in step. With no
 * connection it opens on the copy kept on this device instead, if there is a
 * recent one, and reloads once the server answers. The first Super Admin or
 * CEO to sign in on a new database also saves the default settings, including
 * the permission matrix the database checks against.
 */
export async function openSession(userId: string, employeeId: string): Promise<void> {
  await closeSession()
  const outbox = await restoreOutbox(userId)
  let results: Row[][]
  let syncedAt = Date.now()
  let fromDevice = false
  try {
    results = await fetchEverything()
  } catch (e) {
    const saved = isNetworkError(e) ? await readSnapshot(userId) : null
    if (!saved) throw e
    results = rowsOf(saved)
    syncedAt = saved.syncedAt
    fromDevice = true
  }
  const loaded = build(results, outbox)

  const onOnline = () => {
    // A sign-in that expired while offline is renewed first, so what follows is accepted.
    void supabase().auth.getSession().catch(() => undefined).then(() => {
      void flush()
      if (session?.fromDevice) void resync()
    })
  }
  const onOffline = () => setStatus({ state: 'offline' })
  // Leaving or hiding the page: queue anything not yet compared, so it survives a closed tab.
  const onHide = () => {
    diffDirty()
    saveOutbox()
    if (session?.snapshotTimer) saveSnapshot()
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
    dirty: new Set(),
    outbox,
    channel: null,
    flushing: false,
    retryMs: 2000,
    // Opened on this device's copy: the channel connecting means the server is back, and everything reloads.
    disconnected: fromDevice,
    fromDevice,
    resyncing: false,
    syncedAt,
    keepCopy: true,
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
  setStatus({
    state: fromDevice ? 'offline' : outbox.size ? 'saving' : 'saved',
    pending: outbox.size,
    error: undefined,
    savedCopyFrom: fromDevice ? syncedAt : undefined,
  })

  const me = loaded.db.employees.find((e) => e.id === employeeId)
  const settingsRows = results[COLLECTIONS.findIndex((spec) => spec.key === 'settings')]
  if (!fromDevice && !settingsRows.some((row) => row.id === 'main') && (me?.role === 'super_admin' || me?.role === 'ceo')) {
    current.baseline.get('settings')!.delete('main')
    current.dirty.add('settings')
  }

  current.channel = subscribe(current)
  if (!fromDevice) saveSnapshot()
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
  clearTimeout(current.snapshotTimer)
  current.cleanup()
  store.setPersister(null)
  store.load(emptyDb())
  setStatus({ state: 'saved', pending: 0, error: undefined, savedCopyFrom: undefined })
  if (current.channel) await supabase().removeChannel(current.channel)
}

/** Sends anything still queued, as far as the connection allows. Used before signing out. */
export async function flushNow(): Promise<number> {
  if (!session) return 0
  clearTimeout(session.timer)
  await flush()
  return session?.outbox.size ?? 0
}
