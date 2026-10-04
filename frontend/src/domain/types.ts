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
}

export type StaffAttendanceStatus = 'Present' | 'Half Day' | 'Leave' | 'Absent'

/** Office staff attendance. Site labour attendance comes from daily reports instead. */
export interface StaffAttendance {
  employeeId: ID
  date: string
  status: StaffAttendanceStatus
  checkIn?: string
  checkOut?: string
}

/** Site labour. Workers do not log in — foremen record them. */
export interface Worker {
  id: ID
  name: string
  skill: string
  phone: string
  active: boolean
}

// ---------------------------------------------------------------- CRM

export type LeadStatus = 'New' | 'Contacted' | 'Site Visit' | 'Quoted' | 'Won' | 'Lost'

export interface Lead {
  id: ID
  name: string
  phone: string
  email?: string
  location: string
  source: 'Instagram' | 'Referral' | 'Website' | 'Walk-in' | 'Google' | 'Exhibition'
  status: LeadStatus
  ownerId: ID
  requirement: string
  createdAt: string
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
  /** At least one of these must be true — enforced at creation. */
  services: { design: boolean; execution: boolean }
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
}

/** Project type is derived, never stored — the services decide it. */
export type ProjectType = 'Design Only' | 'Execution Only' | 'Design + Execution'

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

export interface ReportPhoto {
  id: ID
  /** Data URL in the prototype; an object-store key in production. */
  src: string
  caption?: string
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
  visitSchedule: string
  /** AMC only. */
  renewalDate?: string
  value?: number
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
  /** Roles permitted to adjust the OT figure on a submitted report. */
  otAdjustRoles: RoleKey[]
  freeMaintenanceMonths: number
}
