import * as seed from './seed'
import { today } from '../domain/format'
import type {
  CalendarEvent, ChatMessage, Clarification, Client, Consultation, DailyWorkReport,
  DocumentRecord, Employee, ID, Issue, Lead, MaintenanceRecord, Payment, PaymentFollowUp,
  PaymentRequest, Project, Quotation, Settings, SiteAssignment, SiteVisit, StaffAttendance,
  Task, Worker,
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
  staffAttendance: StaffAttendance[]
  settings: Settings
}

// v2 adds client WhatsApp numbers and the AMC, client and employee records.
const STORAGE_KEY = 'landschaft-crm-prototype-v2'

function freshDb(): DbShape {
  // Structured clone keeps the seed module pristine across resets.
  return structuredClone({
    employees: seed.employees,
    workers: seed.workers,
    leads: seed.leads,
    clients: seed.clients,
    siteVisits: seed.siteVisits,
    projects: seed.projects,
    siteAssignments: seed.siteAssignments,
    tasks: seed.tasks,
    reports: seed.reports,
    issues: seed.issues,
    quotations: seed.quotations,
    paymentRequests: seed.paymentRequests,
    payments: seed.payments,
    maintenance: seed.maintenance,
    documents: seed.documents,
    calendarEvents: seed.calendarEvents,
    clarifications: seed.clarifications,
    chatMessages: seed.chatMessages,
    followUps: seed.followUps,
    consultations: seed.consultations,
    staffAttendance: seed.staffAttendance,
    settings: seed.settings,
  })
}

function load(): DbShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshDb()
    const parsed = JSON.parse(raw) as DbShape
    // Guard against a half-written or older payload.
    if (!parsed.projects || !parsed.reports) return freshDb()
    // Collections added after the payload was written start from the seed.
    return { ...freshDb(), ...parsed }
  } catch {
    return freshDb()
  }
}

let db: DbShape = load()
const listeners = new Set<() => void>()

/** Bumped on every commit so useSyncExternalStore sees a new snapshot. */
let version = 0
let snapshot = { version, db }

function commit() {
  version += 1
  snapshot = { version, db }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // Quota or private-browsing failures are non-fatal for a prototype.
  }
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
  /** Mutate through here so every change persists and re-renders. */
  update(fn: (draft: DbShape) => void) {
    fn(db)
    commit()
  },
  reset() {
    db = freshDb()
    commit()
  },
}

let idCounter = Date.now()
export function nextId(prefix: string): ID {
  idCounter += 1
  return `${prefix}${idCounter.toString(36)}`
}

export function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export { today }
