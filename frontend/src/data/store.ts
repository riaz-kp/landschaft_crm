import { defaultSettings } from '../domain/defaults'
import type {
  CalendarEvent, ChatMessage, Clarification, Client, Consultation, DailyWorkReport,
  DocumentRecord, Employee, ID, Issue, Lead, MaintenanceRecord, Payment, PaymentFollowUp,
  PaymentRequest, Project, Quotation, Settings, SiteAssignment, SiteVisit, AttendanceEntry,
  Task, Worker, ProjectMessage, PayRecord, Reminder, ProjectLogEntry,
} from '../domain/types'

export interface DbShape {
  employees: Employee[]
  workers: Worker[]
  leads: Lead[]
  clients: Client[]
  siteVisits: SiteVisit[]
  projects: Project[]
  siteAssignments: SiteAssignment[]
  tasks: Task[]
  reports: DailyWorkReport[]
  issues: Issue[]
  quotations: Quotation[]
  paymentRequests: PaymentRequest[]
  payments: Payment[]
  maintenance: MaintenanceRecord[]
  documents: DocumentRecord[]
  calendarEvents: CalendarEvent[]
  clarifications: Clarification[]
  chatMessages: ChatMessage[]
  followUps: PaymentFollowUp[]
  consultations: Consultation[]
  attendance: AttendanceEntry[]
  projectMessages: ProjectMessage[]
  payRecords: PayRecord[]
  reminders: Reminder[]
  /** Task hand-overs, completions and project edits, written as they happen. */
  projectLog: ProjectLogEntry[]
  /** When each person last opened each project's remarks, keyed "personId:projectId". */
  chatReads: Record<string, string>
  settings: Settings
}

export type CollectionKey = keyof DbShape

export function emptyDb(): DbShape {
  return {
    employees: [], workers: [], leads: [], clients: [], siteVisits: [], projects: [], siteAssignments: [],
    tasks: [], reports: [], issues: [], quotations: [], paymentRequests: [], payments: [], maintenance: [],
    documents: [], calendarEvents: [], clarifications: [], chatMessages: [], followUps: [], consultations: [],
    attendance: [], projectMessages: [], payRecords: [], reminders: [], projectLog: [], chatReads: {},
    settings: defaultSettings(),
  }
}

/**
 * Saves a change. data/sync sends it to Supabase; data/demo keeps it in this
 * browser. `touched` names every collection the change read or wrote.
 */
export type Persister = (touched: ReadonlySet<CollectionKey>, db: DbShape) => void

let db: DbShape = emptyDb()
let persister: Persister | null = null
const listeners = new Set<() => void>()

/** Bumped on every commit so useSyncExternalStore sees a new snapshot. */
let version = 0
let snapshot = { version, db }

function commit() {
  // Records are changed in place, so every collection is handed out as a fresh
  // array. Anything memoised on a collection — the attendance register, a
  // foreman's crew — then sees the change instead of showing the old value.
  db = Object.fromEntries(
    Object.entries(db).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]),
  ) as unknown as DbShape
  version += 1
  snapshot = { version, db }
  listeners.forEach((fn) => fn())
}

export const store = {
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  getSnapshot() {
    return snapshot
  },
  get db() {
    return db
  },
  /** Mutate through here so every change is saved and re-renders. */
  update(fn: (draft: DbShape) => void) {
    // Note which collections the change goes near, so only those are checked for edits.
    const touched = new Set<CollectionKey>()
    const draft = new Proxy(db, {
      get(target, key, receiver) {
        if (typeof key === 'string') touched.add(key as CollectionKey)
        return Reflect.get(target, key, receiver)
      },
      set(target, key, value, receiver) {
        if (typeof key === 'string') touched.add(key as CollectionKey)
        return Reflect.set(target, key, value, receiver)
      },
    })
    fn(draft)
    commit()
    persister?.(touched, db)
  },
  /** Replaces everything — after loading from the server or this browser. Nothing is saved back. */
  load(next: DbShape) {
    db = next
    commit()
  },
  /** Applies a change that someone else made. Nothing is saved back. */
  apply(fn: (draft: DbShape) => void) {
    fn(db)
    commit()
  },
  setPersister(next: Persister | null) {
    persister = next
  },
}

/** A new record id. Random rather than counted, since several people add records at once. */
export function nextId(prefix: string): ID {
  return `${prefix}${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
}

export function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
