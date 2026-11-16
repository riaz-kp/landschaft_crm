import { normalizeSettings } from '../domain/defaults'
import { normalizeQuotation } from '../domain/quotation'
import { normalizePhaseTag, normalizeProjectPhases } from '../domain/designPhases'
import type { PaymentRequest, Project, Quotation, Settings, Task } from '../domain/types'
import type { CollectionKey, DbShape } from './store'

/** One stored record: its id and the record itself. */
export interface Row {
  id: string
  data: unknown
}

/** How one collection maps onto its table. */
export interface CollectionSpec {
  key: CollectionKey
  table: string
  /** The collection's records by id, as they are stored. */
  rows(db: DbShape): Map<string, unknown>
  /** The collection, from its stored rows in the order they were created. */
  build(rows: Row[]): DbShape[CollectionKey]
  /** Sets one record, or removes it when `data` is null. */
  put(db: DbShape, id: string, data: unknown): void
  /** Listed newest first in the app, the reverse of the order `build` takes. */
  newestFirst?: boolean
  /** A newer collection whose table may not exist yet; it then loads empty instead of stopping the app. */
  optional?: boolean
}

type Item = Record<string, unknown>
const byId = (record: Item) => String(record.id)

/**
 * A list collection. `newestFirst` lists grow at the top in the app (leads,
 * quotations), so loaded rows are reversed and new ones go in front. `tidy`
 * brings a record stored in an older shape up to date as it is read; the
 * baseline is taken after it, so tidying alone never counts as a change.
 */
function list(
  key: CollectionKey, table: string, idOf: (record: Item) => string = byId, newestFirst = false,
  tidy: (record: Item) => Item = (record) => record,
): CollectionSpec {
  const items = (db: DbShape) => db[key] as unknown as Item[]
  return {
    key,
    table,
    newestFirst,
    rows: (db) => new Map(items(db).map((record) => [idOf(record), record])),
    build: (rows) => (newestFirst ? [...rows].reverse() : rows).map((row) => tidy(row.data as Item)) as unknown as DbShape[CollectionKey],
    put(db, id, data) {
      const records = items(db)
      const index = records.findIndex((record) => idOf(record) === id)
      if (data === null) {
        if (index >= 0) records.splice(index, 1)
      } else if (index >= 0) {
        records[index] = tidy(data as Item)
      } else if (newestFirst) {
        records.unshift(tidy(data as Item))
      } else {
        records.push(tidy(data as Item))
      }
    },
  }
}

/** BOQs and quotations saved before documents had sections are read in today's shape. */
const tidyQuotation = (record: Item) => normalizeQuotation(record as unknown as Quotation) as unknown as Item
/** Projects, tasks and payment requests saved under the old four design phases are read in today's five. */
const tidyProject = (record: Item) => normalizeProjectPhases(record as unknown as Project) as unknown as Item
const tidyPhaseTag = (record: Item) => normalizePhaseTag(record as unknown as Task | PaymentRequest) as unknown as Item

export const COLLECTIONS: CollectionSpec[] = [
  list('employees', 'employees'),
  list('workers', 'workers'),
  list('leads', 'leads', byId, true),
  list('clients', 'clients'),
  list('siteVisits', 'site_visits'),
  list('projects', 'projects', byId, false, tidyProject),
  // One row per foreman per site.
  list('siteAssignments', 'site_assignments', (a) => `${a.foremanId}:${a.projectId}`),
  list('tasks', 'tasks', byId, false, tidyPhaseTag),
  list('reports', 'reports'),
  list('issues', 'issues'),
  list('quotations', 'quotations', byId, true, tidyQuotation),
  list('paymentRequests', 'payment_requests', byId, false, tidyPhaseTag),
  list('payments', 'payments'),
  list('maintenance', 'maintenance'),
  list('documents', 'documents'),
  list('calendarEvents', 'calendar_events'),
  list('clarifications', 'clarifications'),
  list('chatMessages', 'chat_messages'),
  list('followUps', 'follow_ups'),
  list('consultations', 'consultations'),
  // One row per person per day.
  list('attendance', 'attendance', (a) => `${a.kind}:${a.personId}:${a.date}`),
  list('projectMessages', 'project_messages'),
  list('payRecords', 'pay_records'),
  list('reminders', 'reminders'),
  list('projectLog', 'project_log'),
  // One row per project, written by the client-portal function.
  list('clientBriefs', 'client_briefs'),
  // The materials library. Added after the first release, so it may not exist on every database yet.
  { ...list('materials', 'materials'), optional: true },
  {
    key: 'chatReads',
    table: 'chat_reads',
    rows: (db) => new Map(Object.entries(db.chatReads).map(([id, at]) => [id, { at }])),
    build: (rows) => Object.fromEntries(rows.map((row) => [row.id, (row.data as { at: string }).at])),
    put(db, id, data) {
      if (data === null) delete db.chatReads[id]
      else db.chatReads[id] = (data as { at: string }).at
    },
  },
  {
    // A single row, id "main".
    key: 'settings',
    table: 'settings',
    rows: (db) => new Map([['main', db.settings]]),
    build: (rows) => normalizeSettings(rows.find((row) => row.id === 'main')?.data as Partial<Settings> | undefined),
    put(db, id, data) {
      if (id === 'main' && data !== null) db.settings = normalizeSettings(data as Partial<Settings>)
    },
  },
]

const byKey = new Map(COLLECTIONS.map((spec) => [spec.key, spec]))

export const specFor = (key: CollectionKey): CollectionSpec => byKey.get(key)!

/** Puts a freshly built collection into a database object. */
export function setCollection(db: DbShape, spec: CollectionSpec, value: DbShape[CollectionKey]) {
  (db as unknown as Record<string, unknown>)[spec.key] = value
}
