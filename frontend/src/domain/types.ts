// Domain model for Landschaft CRM.
// Mirrors the client's structure document: a project carries Design and/or
// Execution as optional modules, never as two sequential projects.

export type ID = string

// ---------------------------------------------------------------- roles

export type RoleKey =
  | 'super_admin'
  | 'ceo'
  | 'design_director'
  | 'design_pm'
  | 'design_member'
  | 'execution_head'
  | 'execution_pm'
  | 'foreman'
  | 'accounts'
  | 'marketing'

export interface Role {
  key: RoleKey
  title: string
  /** Short description of the role's remit, taken from the structure document. */
  remit: string
}

/** AMC runs as its own department, separate from Execution. */
export const DEPARTMENTS = ['Management', 'Design', 'Execution', 'AMC', 'Accounts', 'Marketing'] as const
export type Department = (typeof DEPARTMENTS)[number]

/**
 * The departments a client deals with directly. Clarifications, attachments
 * and the internal team chat on a client are each filed under one of these.
 */
export const CLIENT_DEPARTMENTS = ['Design', 'Execution', 'AMC', 'Accounts'] as const
export type ClientDepartment = (typeof CLIENT_DEPARTMENTS)[number]

export const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'] as const

export interface Employee {
  id: ID
  name: string
  role: RoleKey
  /** Title shown on the profile when it differs from the login role, e.g. Co-Founder. */
  designation?: string
  department: Department
  reportsTo?: ID
  phone: string
  whatsapp?: string
  email: string
  /** Profile photo as a data URL in the prototype; an object-store key in production. */
  photo?: string
  dob?: string
  address?: string
  bloodGroup?: string
  qualification?: string
  joinedOn?: string
  fatherName?: string
  fatherOccupation?: string
  motherName?: string
  motherOccupation?: string
  fatherMobile?: string
  siblings?: string
  /** Responsibilities held beyond the login role, e.g. covering AMC as well as Execution. */
  responsibilities?: string[]
  /** Monthly salary in rupees — drives the pay summary on the foreman app and profile. */
  monthlySalary?: number
}

export type StaffAttendanceStatus = 'Present' | 'Half Day' | 'Leave' | 'Absent'
export const ATTENDANCE_STATUSES: StaffAttendanceStatus[] = ['Present', 'Half Day', 'Leave', 'Absent']

/** Office staff and site workers share one register. */
export type PersonKind = 'employee' | 'worker'

/**
 * One person's day on the attendance register. For site workers a missing
 * entry falls back to the foreman's daily report, so the register only stores
 * what someone marked or corrected by hand.
 */
export interface AttendanceEntry {
  kind: PersonKind
  personId: ID
  date: string
  status: StaffAttendanceStatus
  checkIn?: string
  checkOut?: string
  /** Overtime in hours, recorded separately from the working day. */
  otHours?: number
}

/** Site labour. Workers do not log in — foremen record them. */
export interface Worker {
  id: ID
  name: string
  skill: string
  phone: string
  whatsapp?: string
  active: boolean
  photo?: string
  address?: string
  joinedOn?: string
  /** Day rate in rupees. */
  dailyWage?: number
  emergencyContact?: string
  notes?: string
}

// ---------------------------------------------------------------- CRM

export type LeadStatus = 'New' | 'Contacted' | 'Site Visit' | 'Quoted' | 'Won' | 'Lost'

export interface Lead {
  id: ID
  name: string
  phone: string
  /** Stored separately; equal to phone when the lead uses the same number. */
  whatsapp?: string
  email?: string
  location: string
  source: 'Instagram' | 'Referral' | 'Website' | 'Walk-in' | 'Google' | 'Exhibition'
  status: LeadStatus
  ownerId: ID
  requirement: string
  createdAt: string
  notes?: string
  /** Set when the lead converts, linking the two records. */
  clientId?: ID
}

export interface Client {
  id: ID
  name: string
  phone: string
  /** Stored separately; equal to phone when the client uses the same number. */
  whatsapp: string
  email?: string
  address: string
  leadId?: ID
  createdAt: string
}

/** A point needing an answer — raised by the client, or by us awaiting the client. */
export interface Clarification {
  id: ID
  clientId: ID
  projectId?: ID
  department: ClientDepartment
  raisedBy: 'Client' | 'Team'
  question: string
  loggedBy: ID
  raisedOn: string
  status: 'Open' | 'Resolved'
  answer?: string
  answeredBy?: ID
  answeredOn?: string
}

/** Internal staff discussion about a client, one thread per department. */
export interface ChatMessage {
  id: ID
  clientId: ID
  department: ClientDepartment
  authorId: ID
  text: string
  /** Local date-time, YYYY-MM-DDTHH:mm. */
  at: string
}

/** A logged attempt to collect money owed by a client. */
export interface PaymentFollowUp {
  id: ID
  clientId: ID
  projectId?: ID
  date: string
  mode: 'Call' | 'WhatsApp' | 'Email' | 'Visit'
  note: string
  byId: ID
  promisedAmount?: number
  nextFollowUp?: string
}

// ---------------------------------------------------------------- CEO consultations

export type ConsultationStatus = 'Scheduled' | 'Completed' | 'Cancelled'

/** A record of a consultation being moved, kept so the diary shows its history. */
export interface Postponement {
  fromDate: string
  fromStart: string
  toDate: string
  toStart: string
  reason: string
  by: ID
  /** Local date-time the change was made, YYYY-MM-DDTHH:mm. */
  at: string
}

/** A slot on the CEO's consultation schedule. Anyone may book one. */
export interface Consultation {
  id: ID
  date: string
  start: string
  durationMins: number
  purpose: string
  clientId?: ID
  leadId?: ID
  /** Free-text attendee when the meeting is with neither a client nor a lead. */
  attendee?: string
  mode: 'Office' | 'Site' | 'Phone' | 'Video'
  bookedBy: ID
  status: ConsultationStatus
  notes?: string
  postponements?: Postponement[]
}

export type SiteVisitStatus = 'Scheduled' | 'Completed' | 'Cancelled'

export interface SiteVisit {
  id: ID
  leadId?: ID
  clientId?: ID
  location: string
  date: string
  assignedTo: ID
  status: SiteVisitStatus
  notes: string
}

// ---------------------------------------------------------------- projects

/** The four design phases from the structure document, in order. */
export const DESIGN_PHASES = ['concept', 'threeD', 'civilWork', 'boq'] as const
export type DesignPhaseKey = (typeof DESIGN_PHASES)[number]

/** Execution phases. MEP is optional and has its own three sub-services. */
export const EXECUTION_PHASES = ['hardscape', 'softscape', 'mep', 'maintenance'] as const
export type ExecutionPhaseKey = (typeof EXECUTION_PHASES)[number]

export const MEP_SERVICES = ['irrigation', 'electrical', 'drainage'] as const
export type MepServiceKey = (typeof MEP_SERVICES)[number]

export type PhaseKey = DesignPhaseKey | ExecutionPhaseKey

export const PHASE_LABELS: Record<PhaseKey, string> = {
  concept: 'Concept',
  threeD: '3D Presentation',
  civilWork: 'Civil Work',
  boq: 'BOQ',
  hardscape: 'Hardscape',
  softscape: 'Softscape',
  mep: 'MEP',
  maintenance: 'Maintenance',
}

export const MEP_LABELS: Record<MepServiceKey, string> = {
  irrigation: 'Irrigation',
  electrical: 'Electrical',
  drainage: 'Drainage',
}

/** A phase that is part of a project: enabled, with a progress percentage. */
export interface Phase {
  enabled: boolean
  progress: number
}

export interface MepPhase extends Phase {
  services: Record<MepServiceKey, boolean>
}

export type ProjectStatus = 'Planning' | 'In Progress' | 'On Hold' | 'Completed'

export interface LatLng {
  lat: number
  lng: number
}

/**
 * Commercial documents. Which ones a project carries follows its services:
 * Design only → BOQ, Execution only → Quotation, Design + Execution → both.
 */
export type CommercialDoc = 'BOQ' | 'Quotation'

export interface ChecklistTick {
  done: boolean
  by?: ID
  on?: string
}

export interface Project {
  id: ID
  code: string
  name: string
  clientId: ID
  siteLocation: string
  projectManagerId: ID
  startDate: string
  expectedCompletion: string
  status: ProjectStatus
  /**
   * At least one must be true — enforced at creation. AMC (Annual Maintenance
   * Contract) can be sold on its own, without design or execution.
   */
  services: { design: boolean; execution: boolean; amc?: boolean }
  design: Record<DesignPhaseKey, Phase>
  execution: {
    hardscape: Phase
    softscape: Phase
    mep: MepPhase
    maintenance: Phase
  }
  value: number
  /** Flagged when the expected completion has passed and work is unfinished. */
  delayed: boolean
  /** Pin dropped on the map at creation. */
  siteCoords?: LatLng
  /** BOQ and quotation checklist, keyed by checklist item id. */
  checklist?: Record<string, ChecklistTick>
}

/** Project type is derived, never stored — the services decide it, e.g. "Design + Execution" or "AMC Only". */
export type ProjectType = string

/** Which foremen run which sites. Drives the foreman's "My Sites" list. */
export interface SiteAssignment {
  foremanId: ID
  projectId: ID
}

// ---------------------------------------------------------------- tasks

export type TaskStatus = 'To Do' | 'In Progress' | 'Review' | 'Done'
export type TaskPriority = 'Low' | 'Medium' | 'High'

export interface Task {
  id: ID
  projectId: ID
  phase?: PhaseKey
  title: string
  description?: string
  assigneeId: ID
  status: TaskStatus
  priority: TaskPriority
  dueDate: string
  /** Set when the task was generated from a foreman's Next Day Plan. */
  fromReportId?: ID
}

// ------------------------------------------------- daily work report (§6–15)

export interface ReportWorkerEntry {
  workerId: ID
  present: boolean
  checkIn?: string
  checkOut?: string
}

/** "TA" is the client's own term — kept verbatim rather than renamed. */
export interface TaEntry {
  workerId: ID
  distanceKm: number
}

/** Foremen photograph the site twice a day. */
export type PhotoSession = 'Morning' | 'Evening'
export const PHOTO_SESSIONS: PhotoSession[] = ['Morning', 'Evening']

export interface ReportPhoto {
  id: ID
  /** Data URL in the prototype; an object-store key in production. */
  src: string
  caption?: string
  session: PhotoSession
  /** HH:mm the photo was added. */
  takenAt?: string
  /** Size after compression on the phone, and the camera original, in KB. */
  sizeKb?: number
  originalKb?: number
}

export type ReportStatus = 'Draft' | 'Submitted' | 'Approved' | 'Sent Back'

export interface DailyWorkReport {
  id: ID
  projectId: ID
  siteLocation: string
  date: string
  foremanId: ID
  /** Attendance drives the worker count — the total is never typed by hand. */
  attendance: ReportWorkerEntry[]
  startTime: string
  endTime: string
  /** Overtime is held separately and only an authorised role may adjust it. */
  otHours: number
  workDone: string[]
  issues: string[]
  nextDayPlan: string[]
  ta: TaEntry[]
  photos: ReportPhoto[]
  status: ReportStatus
  submittedAt?: string
  submittedBy?: ID
  reviewedAt?: string
  reviewedBy?: ID
  reviewNote?: string
}

/** Raised automatically when a report logs anything other than "Nothing". */
export interface Issue {
  id: ID
  projectId: ID
  reportId: ID
  text: string
  raisedBy: ID
  assignedTo: ID
  date: string
  status: 'Open' | 'Resolved'
}

// ---------------------------------------------------------------- accounts

export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected'

export interface QuotationItem {
  description: string
  quantity: number
  unit: string
  rate: number
}

export interface Quotation {
  id: ID
  /** BOQ for design work, Quotation for execution work. */
  kind: CommercialDoc
  number: string
  projectId: ID
  clientId: ID
  date: string
  items: QuotationItem[]
  status: QuotationStatus
}

export type PaymentRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Paid'

export interface PaymentRequest {
  id: ID
  projectId: ID
  phase?: PhaseKey
  amount: number
  requestedBy: ID
  date: string
  status: PaymentRequestStatus
  note?: string
}

export interface Payment {
  id: ID
  projectId: ID
  clientId: ID
  amount: number
  date: string
  method: 'Bank Transfer' | 'Cheque' | 'UPI' | 'Cash'
  reference: string
  requestId?: ID
}

// ---------------------------------------------------------------- maintenance

export interface MaintenanceVisit {
  id: ID
  date: string
  teamIds: ID[]
  notes: string
  issues: string[]
  photoCount: number
  done: boolean
  /** The repeat-schedule date this visit fulfils, when it was moved to another day. */
  plannedFor?: string
}

export type RecurrenceUnit = 'day' | 'week' | 'month'

/**
 * How often an AMC site is visited — every N days, weeks or months from the
 * first visit — and how far ahead the team is reminded. Set per contract in
 * the AMC section.
 */
export interface VisitSchedule {
  every: number
  unit: RecurrenceUnit
  firstVisit: string
  /** Remind this many days before each visit. */
  reminderDaysBefore: number
}

export interface MaintenanceRecord {
  id: ID
  projectId: ID
  /** The document specifies the first month after handover as free. */
  type: 'Free Maintenance' | 'AMC'
  startDate: string
  endDate: string
  teamIds: ID[]
  visits: MaintenanceVisit[]
  scopeOfWork: string
  /** Free-text note on the schedule, e.g. "1st and 3rd Tuesday". */
  visitSchedule: string
  /** The repeating visit plan that drives the AMC calendar and reminders. */
  schedule?: VisitSchedule
  /** AMC only. */
  renewalDate?: string
  /** Remind this many days before the renewal date. */
  renewalReminderDays?: number
  value?: number
}

// ---------------------------------------------------------------- project remarks

/** One message in a project's remarks thread — the team's WhatsApp-style chat. */
export interface ProjectMessage {
  id: ID
  projectId: ID
  authorId: ID
  text: string
  /** Local date-time, YYYY-MM-DDTHH:mm. */
  at: string
  /** A compressed photo attached to the message. */
  photo?: string
  replyToId?: ID
}

// ---------------------------------------------------------------- staff pay

export type PayType = 'Salary' | 'Wages' | 'Advance' | 'TA' | 'Bonus' | 'Deduction'

/** A payment made to an employee or a site worker. */
export interface PayRecord {
  id: ID
  kind: PersonKind
  personId: ID
  date: string
  amount: number
  type: PayType
  /** The month it relates to, YYYY-MM. */
  period?: string
  method: 'Bank Transfer' | 'Cash' | 'UPI' | 'Cheque'
  note?: string
  paidBy: ID
}

// ---------------------------------------------------------------- documents

export interface DocumentRecord {
  id: ID
  name: string
  projectId?: ID
  /** Set on client attachments, which are filed by department. */
  clientId?: ID
  department?: ClientDepartment
  category: 'Drawing' | 'BOQ' | 'Contract' | 'Photo' | 'Report' | 'Other'
  uploadedBy: ID
  uploadedAt: string
  sizeKb: number
}

export interface CalendarEvent {
  id: ID
  title: string
  date: string
  type: 'Site Visit' | 'Deadline' | 'Maintenance' | 'Meeting'
  projectId?: ID
  assigneeId?: ID
}

// ---------------------------------------------------------------- settings

/**
 * Everything the structure document explicitly asked to stay configurable
 * rather than hard-coded.
 */
export interface Settings {
  /** Design payment split by phase. Must total 100. */
  designPaymentSplit: Record<DesignPhaseKey, number>
  /** The document deliberately leaves TA undefined, so it is off by default. */
  taEnabled: boolean
  taRatePerKm: number
  photosMandatory: boolean
  /** Photos are shrunk on the foreman's phone before upload: longest side in px, and a size target in KB. */
  photoMaxPx: number
  photoMaxKb: number
  /** Roles permitted to adjust the OT figure on a submitted report. */
  otAdjustRoles: RoleKey[]
  freeMaintenanceMonths: number
  /** Module access per role, edited from Settings → Roles & Permissions. */
  permissions: PermissionMatrix
  /** Company-wide off days (holidays) on top of Sundays. */
  holidays: string[]
}

// ---------------------------------------------------------------- permissions

/** Every module a role can be granted, matching the sidebar. */
export const MODULES = [
  'Dashboard', 'CEO Consultations', 'CRM', 'Projects', 'Tasks', 'Design', 'Execution', 'AMC',
  'Accounts', 'Employees', 'Gallery', 'Documents', 'Calendar', 'Reports', 'Settings',
] as const
export type ModuleKey = (typeof MODULES)[number]

export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete'] as const
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]
export type ModulePermission = Record<PermissionAction, boolean>
export type PermissionMatrix = Record<RoleKey, Record<ModuleKey, ModulePermission>>
