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
  /** Profile photo: a stored-file reference ("sb:…"), or a data URL. See data/files. */
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

// ---------------------------------------------------------------- consultations & site visits

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

/**
 * A slot on a consultation diary — the CEO's, or another senior person who
 * takes consultations (the Design Director, the Head of Execution). Anyone may book one.
 */
export interface Consultation {
  id: ID
  /** Whose diary it is on. Older bookings have none and belong to the CEO. */
  hostId?: ID
  date: string
  start: string
  durationMins: number
  purpose: string
  clientId?: ID
  leadId?: ID
  /** Free-text attendee when the meeting is with neither a client nor a lead. */
  attendee?: string
  mode: 'Office' | 'Site' | 'Phone' | 'Video'
  /** Where a site consultation is held, and its pin on the map. */
  location?: string
  coords?: LatLng
  bookedBy: ID
  status: ConsultationStatus
  notes?: string
  postponements?: Postponement[]
}

export type SiteVisitStatus = 'Scheduled' | 'Completed' | 'Cancelled'

/**
 * A visit to a lead's or client's site. One person leads it; others can go
 * along as a group, and everyone on it is reminded ahead of the day.
 */
export interface SiteVisit {
  id: ID
  leadId?: ID
  clientId?: ID
  location: string
  /** The site's pin on the map. Without one, a client's pinned project site stands in. */
  coords?: LatLng
  date: string
  /** HH:mm the team meets on site. Optional — older visits have none. */
  time?: string
  /** Who leads the visit. */
  assignedTo: ID
  /** Other employees going along. */
  teamIds?: ID[]
  /** Remind everyone on the visit this many days before (0 = on the day). Unset means no reminder. */
  remindDaysBefore?: number
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
export const PROJECT_STATUSES: ProjectStatus[] = ['Planning', 'In Progress', 'On Hold', 'Completed']

/**
 * What kind of property the project is for. Shown as "Project Type"; the mix of
 * services sold (Design Only, Design + Execution…) is shown as "Services".
 */
export const PROJECT_CATEGORIES = ['Residential', 'Commercial', 'Hospitality', 'Institutional'] as const
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number]

/** Kerala sites are measured in square feet, or in cents and acres for land. */
export const AREA_UNITS = ['sq ft', 'sq m', 'cents', 'acres'] as const
export type AreaUnit = (typeof AREA_UNITS)[number]

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

/** The documents a client hands over at the start of a project. See domain/clientDocs. */
export type ClientDocKey = 'model3d' | 'contour' | 'presentation' | 'archFloor' | 'archSections' | 'archElevations' | 'sitePhotos'

/** A client document marked received, or not needed on this project. Anything unmarked is still pending. */
export interface ClientDocTick {
  status: 'Received' | 'Not Needed'
  by?: ID
  on?: string
  note?: string
}

/** How the design fee is to be worked out, chosen when the project is opened. */
export const FEE_BASES = ['Lump Sum', 'Area Based', 'Scope Based', 'To Be Decided'] as const
export type FeeBasis = (typeof FEE_BASES)[number]

/** What has to happen next on a new enquiry, chosen when the project is opened and updated as it moves. */
export const NEXT_ACTIONS = [
  'Prepare scope proposal', 'Client follow-up', 'Collect information', 'Site visit', 'Design team review',
] as const
export type NextAction = (typeof NEXT_ACTIONS)[number]

/** The hand-offs a project moves through, from enquiry to work starting on site. See domain/workflow. */
export type WorkflowStepKey =
  | 'siteVisit' | 'scopePrepared' | 'scopeToCeo' | 'scopeToClient' | 'clientApproved' | 'scopeConfirmed'
  | 'teamAllocated' | 'conceptDone' | 'civilDone' | 'quotationSent' | 'workStarted'

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
  /**
   * The project value the dashboards and receivables count. Fixed by Accounts
   * and may change as the project goes on. When the design and execution
   * values are set it is their sum.
   */
  value: number
  /** Accounts' value for the design work and for the execution work. Each one's payment slabs come from Settings. */
  designValue?: number
  executionValue?: number
  /** What the client said they could spend, from the first discussion. Kept apart from the project value. */
  budget?: number
  /** The client's preliminary requirement, noted when the project is opened. */
  requirement?: string
  /** The site must be visited before the scope proposal goes out. */
  siteVisitRequired?: boolean
  feeBasis?: FeeBasis
  nextAction?: NextAction
  /** Hand-offs ticked off so far, keyed by step. See domain/workflow. */
  workflow?: Partial<Record<WorkflowStepKey, ChecklistTick>>
  /** Payment-schedule rows Accounts has been told are due (ScheduleRow.key), so each is told once. */
  paymentsFlagged?: string[]
  /** Flagged when the expected completion has passed and work is unfinished. */
  delayed: boolean
  /** Pin dropped on the map at creation. */
  siteCoords?: LatLng
  /** BOQ and quotation checklist, keyed by checklist item id. */
  checklist?: Record<string, ChecklistTick>
  /** Residential, Commercial, Hospitality or Institutional. */
  category?: ProjectCategory
  /** Site area, in `areaUnit`. */
  area?: number
  areaUnit?: AreaUnit
  /** Documents received from the client — 3D model, contour drawing, architectural drawings… */
  clientDocs?: Partial<Record<ClientDocKey, ClientDocTick>>
  /**
   * The secret in the link the client fills the requirement checklist through
   * (/portal/checklist/…). Cleared to switch the link off.
   */
  briefToken?: string
  /**
   * The project in the plants app (plants.landschaft.in) whose plant list this
   * project's BOQ and quotation take their plants from. Matched by name.
   */
  plantsProject?: { id: string; name: string }
}

/** Answers on the client's requirement checklist, keyed by question. See domain/clientBrief. */
export type BriefAnswers = Record<string, string | string[]>

/**
 * The landscape requirement checklist a client fills in through their link —
 * family, how the garden will be used, style, budget. One per project, with
 * the project's id. Written by the client portal; the team reads it.
 */
export interface ClientBrief {
  id: ID
  projectId: ID
  answers: BriefAnswers
  /** When the client first sent it, and last changed it — ISO date-times. */
  submittedAt: string
  updatedAt: string
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
  /** What was done, written when the task is marked Done. Cleared if it is reopened. */
  doneNote?: string
  /** Date the task was marked Done, and by whom. */
  doneOn?: string
  doneBy?: ID
}

// ---------------------------------------------------------------- project history

export type ProjectLogKind =
  | 'task-created' | 'task-reassigned' | 'task-done' | 'task-reopened' | 'task-deleted'
  | 'project-edited' | 'workflow-step' | 'payment-due'

/**
 * One entry in a project's history. Task hand-overs, completions and edits are
 * written here as they happen, so the history survives the task being deleted.
 */
export interface ProjectLogEntry {
  id: ID
  projectId: ID
  taskId?: ID
  kind: ProjectLogKind
  /** Local date-time, YYYY-MM-DDTHH:mm. */
  at: string
  byId: ID
  title: string
  detail?: string
  /** For a reassignment: who had the task, and who has it now. */
  fromId?: ID
  toId?: ID
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
  /** A stored-file reference ("sb:…"), or a data URL when taken offline. See data/files. */
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

/** A line from before documents had sections. Read as a management line; never written now. */
export interface QuotationItem {
  description: string
  quantity: number
  unit: string
  rate: number
}

/**
 * A plant on a BOQ or quotation, copied from a project in the plants app
 * (plants.landschaft.in). Plants are chosen, sized and priced there, never in
 * the CRM; the document keeps a copy so what was sent to a client does not
 * change under it until someone fetches the list again.
 */
export interface PlantLine {
  /** The plant's id in the plants app. */
  plantId: string
  name: string
  botanical?: string
  /** Climber, Fern, Palm, Shrub, Tree… The document groups plants by it. */
  category: string
  /** The plant's photo on the plants app's image host. */
  image?: string
  /** Height / size in feet as the plants app records it: "2.5", "3-6". */
  size?: string
  quantity?: number
  unit?: string
  rate?: number
  notes?: string
}

/** The plants-app project a document's plants were copied from, when, and the copy itself. */
export interface PlantsCopy {
  projectId: string
  projectName: string
  /** ISO date-time the list was fetched. */
  fetchedAt: string
  /** When the plants-app project was last changed, as of that fetch. */
  updatedAt?: string
  lines: PlantLine[]
}

/** One stone or item laid in an area: "Bangalore Stone · 1 x 4 · 2283 Sqft". */
export interface AreaItem {
  id: ID
  item: string
  /**
   * The material specification and laying method, one point per line, as the
   * BOQ spreadsheet gives it under the item. Lines such as "Laying method" on
   * their own are printed as small headings.
   */
  specification?: string
  /** Size of the stone or item, e.g. "1 x 4". */
  dimension?: string
  quantity: number
  unit: string
  /** Quotations only; a BOQ carries no prices. */
  rate?: number
  /** An optional photo of the stone or item: a stored file ("sb:…"), or a data URL until it is uploaded. */
  image?: string
}

/**
 * An area of the site with its own heading, its plan, and the stones and items
 * laid there. Plans appear on a BOQ, and on a quotation when the project has
 * design; an execution-only quotation has none.
 */
export interface QuoteArea {
  id: ID
  name: string
  /** A stored file ("sb:…"), or a data URL until it is uploaded. */
  planImage?: string
  items: AreaItem[]
}

/** Labour, supervision, soil preparation, transport: a line with the scope it covers. */
export interface ServiceLine {
  id: ID
  title: string
  description?: string
  quantity: number
  unit: string
  rate: number
}

/** A titled paragraph: one of the terms, or one step of the work procedure. */
export interface TitledText {
  title: string
  text: string
}

/** One stage of payment, as a share of the grand total. */
export interface PaymentStage {
  label: string
  percent: number
}

/** The "Work Schedule / Details" block of a quotation. */
export interface WorkSchedule {
  /** Work starts within this many days of the advance and site clearance. */
  mobilisationDays?: number
  /** Roughly this many working days on site. */
  executionDays?: number
  validity: string
  maintenance: string
  billing: string
}

/** The parts a document can carry, each switched on or off per document. */
export const QUOTE_SECTIONS = ['plants', 'hardscape', 'services', 'terms', 'procedure', 'payment', 'schedule', 'bank', 'acceptance'] as const
export type QuoteSection = (typeof QUOTE_SECTIONS)[number]

/** The cover letter on the first page. */
export interface CoverLetter {
  greeting: string
  body: string
  signOff: string
}

/**
 * A BOQ or a quotation. A BOQ holds quantities and specifications only; a
 * quotation is the same with rates, amounts, a summary and a payment schedule.
 * Which one a project carries follows its services — see domain/commercial.
 */
export interface Quotation {
  id: ID
  kind: CommercialDoc
  number: string
  projectId: ID
  clientId: ID
  date: string
  status: QuotationStatus
  letter: CoverLetter
  /** The paragraph under the "Bill of Quantities" heading. */
  intro: string
  sections: Record<QuoteSection, boolean>
  plants?: PlantsCopy
  /** Hardscape, area by area. */
  areas: QuoteArea[]
  /** Heading of the management section, e.g. "Project Management, Planting, Soil Preparation & Logistics". */
  servicesTitle: string
  services: ServiceLine[]
  /** Rupees off the total. Quotations only. */
  discount: number
  /**
   * GST charged on the taxable value (the total after discount), in percent.
   * Left out when the quotation is quoted without GST. Quotations only.
   */
  gstRate?: number
  terms: TitledText[]
  procedure: TitledText[]
  procedureNote: string
  paymentStages: PaymentStage[]
  schedule: WorkSchedule
  /** Lines from before documents had sections; see QuotationItem. */
  items?: QuotationItem[]
  createdBy?: ID
}

/**
 * Company details, wording and starting content for BOQs and quotations.
 * A new document copies the defaults; each document can then be changed on its own.
 */
export interface DocumentSettings {
  company: { name: string; tagline: string; offices: string; phone: string; email: string }
  bank: { accountName: string; bankName: string; accountNumber: string; ifsc: string }
  letters: Record<CommercialDoc, CoverLetter>
  intros: Record<CommercialDoc, string>
  servicesTitle: string
  services: Omit<ServiceLine, 'id'>[]
  terms: TitledText[]
  procedure: TitledText[]
  procedureNote: string
  paymentStages: PaymentStage[]
  schedule: WorkSchedule
  acceptance: Record<CommercialDoc, string>
  /** Where the plants app is opened, for links to a project's plant list. */
  plantsAppUrl: string
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

/** A photo taken on a maintenance visit. The client sees it on the AMC report link. */
export interface VisitPhoto {
  id: ID
  /** A stored-file reference ("sb:…"), or a data URL in the demo. See data/files. */
  src: string
  caption?: string
}

/** A document attached to a maintenance visit — a service sheet, a signed report. */
export interface VisitFile {
  name: string
  /**
   * The file in the bucket ("sb:…"), or a link to where it is kept (a Google
   * Drive share…). An upload in the demo keeps only the name.
   */
  file?: string
  /** Absent on a link. */
  sizeKb?: number
}

export interface MaintenanceVisit {
  id: ID
  date: string
  teamIds: ID[]
  notes: string
  issues: string[]
  /** Photos from before they were stored on the visit; `photos` replaces it. */
  photoCount: number
  photos?: VisitPhoto[]
  files?: VisitFile[]
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
  /**
   * The secret in the client's report link (/portal/amc/…). Anyone holding the
   * link sees the visit reports and photos, without signing in. Cleared to switch it off.
   */
  shareToken?: string
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
  /** Set when the file is one of the documents the client handed over for the project. */
  clientDoc?: ClientDocKey
  /**
   * The file itself, in the file bucket ("sb:…"), or a link to where it is kept
   * (a Google Drive or Dropbox share). Absent on records from before files were stored.
   */
  file?: string
  category: 'Drawing' | 'BOQ' | 'Contract' | 'Photo' | 'Report' | 'Other'
  uploadedBy: ID
  uploadedAt: string
  /** Absent on a link. */
  sizeKb?: number
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
  /** The stages an execution project's value is collected in, in order. Must total 100. */
  executionPaymentSlabs: PaymentSlab[]
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
  /**
   * Trades offered when adding a site worker. Grows when someone adds a new
   * skill from the worker form, and is tidied up from Settings.
   */
  workerSkills: string[]
  /**
   * The normal working day, as HH:mm. Marking someone present in the
   * attendance register fills these in as their time in and out — a half day
   * ends at `halfDayEnd` — and any day can still be changed by hand.
   */
  workHours: WorkHours
  /** Company details and default wording for BOQ and quotation documents. */
  documents: DocumentSettings
}

/** One stage of collecting an execution project's value, e.g. 50% when work starts. */
/** When an execution slab falls due: work starting, a phase reaching 100%, or the project completed. */
export type SlabDue = 'workStarted' | 'hardscape' | 'softscape' | 'mep' | 'completed'

export interface PaymentSlab {
  label: string
  percent: number
  dueAt: SlabDue
}

export interface WorkHours {
  start: string
  end: string
  halfDayEnd: string
}

// ---------------------------------------------------------------- permissions

/**
 * Every module a role can be granted, matching the sidebar. Site Visits and
 * Attendance are tabs inside Consultations and Employees, but carry their own
 * permission so either can be granted without the rest of its section.
 */
export const MODULES = [
  'Dashboard', 'Consultations', 'Site Visits', 'CRM', 'Projects', 'Tasks', 'Design', 'Execution', 'AMC',
  'Accounts', 'Employees', 'Attendance', 'Gallery', 'Documents', 'Calendar', 'Reports', 'Settings',
] as const
export type ModuleKey = (typeof MODULES)[number]

export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete'] as const
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]
export type ModulePermission = Record<PermissionAction, boolean>
export type PermissionMatrix = Record<RoleKey, Record<ModuleKey, ModulePermission>>

// ---------------------------------------------------------------- reminders

export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

/** A personal or team reminder added from the calendar. */
export interface Reminder {
  id: ID
  title: string
  date: string
  /** HH:mm, optional — an all-day reminder has none. */
  time?: string
  repeat: ReminderRepeat
  /** Last date a repeating reminder runs to. */
  until?: string
  notes?: string
  projectId?: ID
  createdBy: ID
  /** Who sees it. Empty means everyone. */
  forIds: ID[]
  /** A workflow hand-off sent to others: it shows only on their bells, not the sender's. */
  notice?: boolean
  /** Where the bell takes them, e.g. "/projects/p1?tab=tasks". */
  link?: string
  /** Dates ticked off — one entry per occurrence of a repeating reminder. */
  doneDates: string[]
}
