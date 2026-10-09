import * as seed from './seed'
import { today } from '../domain/format'
import type {
  CalendarEvent, ChatMessage, Clarification, Client, Consultation, DailyWorkReport,
  DocumentRecord, Employee, ID, Issue, Lead, MaintenanceRecord, Payment, PaymentFollowUp,
  PaymentRequest, Project, Quotation, Settings, SiteAssignment, SiteVisit, AttendanceEntry,
  Task, Worker, ProjectMessage, PayRecord, Reminder,
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
  /** When each person last opened each project's remarks, keyed "personId:projectId". */
  chatReads: Record<string, string>
  settings: Settings
}

// v4 adds AMC as a project service with repeat visit schedules, project remarks,
// staff pay records and lead WhatsApp numbers. v3 added the permission matrix,
// the shared attendance register, morning/evening
// site photos, BOQ & quotation checklists and project map pins.
const STORAGE_KEY = 'landschaft-crm-prototype-v4'

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
    attendance: seed.attendance,
    projectMessages: seed.projectMessages,
    payRecords: seed.payRecords,
    reminders: seed.reminders,
    chatReads: {},
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
    // Collections and settings added after the payload was written start from the seed.
    const fresh = freshDb()
    return { ...fresh, ...parsed, settings: { ...fresh.settings, ...parsed.settings } }
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
