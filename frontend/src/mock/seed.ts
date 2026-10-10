import { addDays, today } from '../domain/format'
import { defaultPermissions } from '../domain/roles'
import type {
  AttendanceEntry, CalendarEvent, ChatMessage, Clarification, Client, Consultation, DailyWorkReport,
  DocumentRecord, Employee, Issue, Lead, MaintenanceRecord, Payment, PaymentFollowUp,
  MaintenanceVisit, PaymentRequest, Phase, PhotoSession, Project, Quotation, ReportPhoto, Settings, SiteAssignment,
  SiteVisit, StaffAttendanceStatus, Task, Worker, ProjectMessage, PayRecord, Reminder,
} from '../domain/types'
import { placeholderSitePhoto } from './photos'
import { CHECKLISTS } from '../domain/commercial'
import type { ChecklistTick } from '../domain/types'

const phase = (enabled: boolean, progress = 0): Phase => ({ enabled, progress })

/** The organisational structure supplied by the client, reproduced verbatim. */
export const employees: Employee[] = [
  { id: 'e0', name: 'System Administrator', role: 'super_admin', department: 'Management', phone: '+91 90000 00000', email: 'admin@landschaft.in' },
  { id: 'e1', name: 'Ashfaq', role: 'ceo', department: 'Management', phone: '+91 98470 11001', email: 'ashfaq@landschaft.in' },
  { id: 'e2', name: 'Anees', role: 'design_director', designation: 'Co-Founder & Design Director', department: 'Design', reportsTo: 'e1', phone: '+91 98470 11002', email: 'anees@landschaft.in' },
  { id: 'e3', name: 'Sai Krishna', role: 'design_pm', department: 'Design', reportsTo: 'e2', phone: '+91 98470 11003', email: 'saikrishna@landschaft.in' },
  { id: 'e4', name: 'Mustafa', role: 'design_member', department: 'Design', reportsTo: 'e3', phone: '+91 98470 11004', email: 'mustafa@landschaft.in' },
  { id: 'e5', name: 'Nihal', role: 'design_member', department: 'Design', reportsTo: 'e3', phone: '+91 98470 11005', email: 'nihal@landschaft.in' },
  { id: 'e6', name: 'Thameem', role: 'execution_head', department: 'Execution', reportsTo: 'e1', phone: '+91 98470 11006', email: 'thameem@landschaft.in' },
  { id: 'e7', name: 'Jidhin', role: 'execution_pm', department: 'Execution', reportsTo: 'e6', phone: '+91 98470 11007', email: 'jidhin@landschaft.in' },
  { id: 'e8', name: 'Arshad', role: 'accounts', department: 'Accounts', reportsTo: 'e1', phone: '+91 98470 11008', email: 'arshad@landschaft.in' },
  { id: 'e9', name: 'Anaswara', role: 'accounts', department: 'Accounts', reportsTo: 'e8', phone: '+91 98470 11009', email: 'anaswara@landschaft.in' },
  { id: 'e10', name: 'Swalih', role: 'marketing', department: 'Marketing', reportsTo: 'e1', phone: '+91 98470 11010', email: 'swalih@landschaft.in' },
  // Site work heads / foremen — each gets their own login.
  { id: 'e11', name: 'Ashiq', role: 'foreman', department: 'Execution', reportsTo: 'e7', phone: '+91 98470 11011', email: 'ashiq@landschaft.in', monthlySalary: 28000, joinedOn: '2021-06-14' },
  { id: 'e12', name: 'Niyas', role: 'foreman', department: 'Execution', reportsTo: 'e7', phone: '+91 98470 11012', email: 'niyas@landschaft.in', monthlySalary: 30000, joinedOn: '2020-11-02' },
  { id: 'e13', name: 'Shihab', role: 'foreman', department: 'Execution', reportsTo: 'e7', phone: '+91 98470 11013', email: 'shihab@landschaft.in', monthlySalary: 27000, joinedOn: '2022-03-21' },
]

/** Site labour. Workers are recorded by foremen and do not log in. */
export const workers: Worker[] = [
  { id: 'w1', name: 'Ashiq', skill: 'Foreman / Planting', phone: '+91 97450 20001', active: true, joinedOn: '2021-06-14', dailyWage: 1400 },
  { id: 'w2', name: 'Niyas', skill: 'Foreman / Hardscape', phone: '+91 97450 20002', active: true, joinedOn: '2020-11-02', dailyWage: 1400 },
  { id: 'w3', name: 'Shihab', skill: 'Foreman / Lawn', phone: '+91 97450 20003', active: true, joinedOn: '2022-03-21', dailyWage: 1350 },
  { id: 'w4', name: 'Junaid', skill: 'Mason', phone: '+91 97450 20004', active: true, joinedOn: '2022-08-01', dailyWage: 1100 },
  { id: 'w5', name: 'Rafeeq', skill: 'Mason', phone: '+91 97450 20005', active: true, joinedOn: '2023-01-16', dailyWage: 1100 },
  { id: 'w6', name: 'Sabu', skill: 'Gardener', phone: '+91 97450 20006', active: true, joinedOn: '2021-09-06', dailyWage: 950 },
  { id: 'w7', name: 'Manoj', skill: 'Gardener', phone: '+91 97450 20007', active: true, joinedOn: '2023-05-08', dailyWage: 950 },
  { id: 'w8', name: 'Vinod', skill: 'Helper', phone: '+91 97450 20008', active: true, joinedOn: '2024-02-12', dailyWage: 850 },
  { id: 'w9', name: 'Salim', skill: 'Plumber / Irrigation', phone: '+91 97450 20009', active: true, joinedOn: '2022-10-10', dailyWage: 1200 },
  { id: 'w10', name: 'Faisal', skill: 'Electrician', phone: '+91 97450 20010', active: true, joinedOn: '2023-07-03', dailyWage: 1200 },
  { id: 'w11', name: 'Anand', skill: 'Helper', phone: '+91 97450 20011', active: true, joinedOn: '2024-06-17', dailyWage: 850 },
  { id: 'w12', name: 'Basheer', skill: 'Driver / Helper', phone: '+91 97450 20012', active: false, joinedOn: '2021-01-04', dailyWage: 900, notes: 'On long leave since July.' },
  { id: 'w13', name: 'Rasheed', skill: 'Tile & Paver Layer', phone: '+91 97450 20013', active: true, joinedOn: '2023-03-13', dailyWage: 1150 },
  { id: 'w14', name: 'Bijoy', skill: 'Gardener', phone: '+91 97450 20014', active: true, joinedOn: '2024-01-08', dailyWage: 950 },
  { id: 'w15', name: 'Shameer', skill: 'Mason', phone: '+91 97450 20015', active: true, joinedOn: '2022-12-05', dailyWage: 1100 },
  { id: 'w16', name: 'Santhosh', skill: 'Helper', phone: '+91 97450 20016', active: true, joinedOn: '2024-04-22', dailyWage: 850 },
  { id: 'w17', name: 'Nazar', skill: 'Welder / Fabricator', phone: '+91 97450 20017', active: true, joinedOn: '2023-09-18', dailyWage: 1250 },
  { id: 'w18', name: 'Riyas', skill: 'Gardener', phone: '+91 97450 20018', active: true, joinedOn: '2022-06-27', dailyWage: 950 },
  { id: 'w19', name: 'Sunil', skill: 'Helper', phone: '+91 97450 20019', active: true, joinedOn: '2024-08-05', dailyWage: 850 },
  { id: 'w20', name: 'Hamza', skill: 'Lawn Specialist', phone: '+91 97450 20020', active: true, joinedOn: '2021-11-15', dailyWage: 1050 },
]

/** Company holidays on top of the Sunday weekly off. */
const HOLIDAYS = ['2026-08-26', '2026-10-02', '2026-11-08', '2026-12-25']

export const clients: Client[] = [
  { id: 'c1', name: 'ABC Holdings', phone: '+91 94470 30001', whatsapp: '+91 94470 30001', email: 'contact@abcholdings.in', address: 'Kowdiar, Thiruvananthapuram', leadId: 'l1', createdAt: '2026-04-12' },
  { id: 'c2', name: 'XYZ Estates', phone: '+91 94470 30002', whatsapp: '+91 99610 40002', email: 'projects@xyzestates.in', address: 'Panampilly Nagar, Kochi', leadId: 'l2', createdAt: '2026-05-02' },
  { id: 'c3', name: 'DEF Resorts', phone: '+91 94470 30003', whatsapp: '+91 99610 40003', email: 'gm@defresorts.in', address: 'Kovalam, Thiruvananthapuram', leadId: 'l3', createdAt: '2026-05-20' },
  { id: 'c4', name: 'Dr. Ramesh Nair', phone: '+91 94470 30004', whatsapp: '+91 94470 30004', email: 'ramesh.nair@gmail.com', address: 'Edava, Varkala', createdAt: '2026-06-08' },
  { id: 'c5', name: 'Greenfield Apartments', phone: '+91 94470 30005', whatsapp: '+91 94470 30005', email: 'assoc@greenfield.in', address: 'Kozhikode', createdAt: '2026-06-25' },
  { id: 'c6', name: 'Marine Drive Towers Association', phone: '+91 94470 30011', whatsapp: '+91 94470 30011', email: 'secretary@marinedrivetowers.in', address: 'Marine Drive, Kochi', createdAt: addDays(today(), -60) },
]

export const leads: Lead[] = [
  { id: 'l1', name: 'ABC Holdings', phone: '+91 94470 30001', email: 'contact@abcholdings.in', location: 'Thiruvananthapuram', source: 'Referral', status: 'Won', ownerId: 'e10', requirement: 'Residence landscape design for a new villa', createdAt: '2026-03-28', clientId: 'c1' },
  { id: 'l2', name: 'XYZ Estates', phone: '+91 94470 30002', location: 'Kochi', source: 'Website', status: 'Won', ownerId: 'e10', requirement: 'Villa landscape execution, design already done in-house', createdAt: '2026-04-18', clientId: 'c2' },
  { id: 'l3', name: 'DEF Resorts', phone: '+91 94470 30003', location: 'Kovalam', source: 'Exhibition', status: 'Won', ownerId: 'e1', requirement: 'Full resort landscape — design and execution', createdAt: '2026-05-05', clientId: 'c3' },
  { id: 'l4', name: 'Suresh Menon', phone: '+91 94470 30006', location: 'Kollam', source: 'Instagram', status: 'Quoted', ownerId: 'e10', requirement: 'Terrace garden, approx 1200 sq ft', createdAt: '2026-08-02' },
  { id: 'l5', name: 'Lakeview Villas', phone: '+91 94470 30007', whatsapp: '+91 99610 40007', email: 'info@lakeview.in', location: 'Alappuzha', source: 'Google', status: 'Site Visit', ownerId: 'e10', requirement: 'Common area landscaping for 18 villas', createdAt: '2026-08-11' },
  { id: 'l6', name: 'Fathima Beevi', phone: '+91 94470 30008', whatsapp: '+91 94470 30008', location: 'Malappuram', source: 'Referral', status: 'Contacted', ownerId: 'e10', requirement: 'Front yard redesign with water feature', createdAt: '2026-08-19' },
  { id: 'l7', name: 'Cyber Park Facility', phone: '+91 94470 30009', email: 'facility@cyberpark.in', location: 'Kozhikode', source: 'Website', status: 'New', ownerId: 'e10', requirement: 'Campus softscape AMC enquiry', createdAt: '2026-08-26' },
  { id: 'l8', name: 'Hotel Sea Pearl', phone: '+91 94470 30010', location: 'Varkala', source: 'Walk-in', status: 'Lost', ownerId: 'e10', requirement: 'Poolside landscaping — went with another vendor', createdAt: '2026-07-14' },
]

export const siteVisits: SiteVisit[] = [
  { id: 'sv1', leadId: 'l5', location: 'Alappuzha', coords: { lat: 9.4981, lng: 76.3388 }, date: addDays(today(), 2), time: '10:30', assignedTo: 'e2', teamIds: ['e3', 'e10'], remindDaysBefore: 2, status: 'Scheduled', notes: 'Measure common areas and check soil drainage.' },
  { id: 'sv2', leadId: 'l6', location: 'Malappuram', coords: { lat: 11.0510, lng: 76.0711 }, date: addDays(today(), 4), time: '14:00', assignedTo: 'e3', teamIds: ['e4'], remindDaysBefore: 1, status: 'Scheduled', notes: 'Client wants a water feature — check water supply.' },
  { id: 'sv6', clientId: 'c6', location: 'Marine Drive, Kochi', coords: { lat: 9.9816, lng: 76.2756 }, date: addDays(today(), 1), time: '11:00', assignedTo: 'e1', teamIds: ['e2', 'e6'], remindDaysBefore: 1, status: 'Scheduled', notes: 'Walk the podium garden with the association before the AMC proposal.' },
  { id: 'sv3', leadId: 'l4', location: 'Kollam', coords: { lat: 8.8932, lng: 76.6141 }, date: addDays(today(), -6), time: '11:00', assignedTo: 'e2', teamIds: ['e5'], status: 'Completed', notes: 'Terrace load-bearing confirmed adequate. Quote sent.' },
  { id: 'sv4', clientId: 'c5', location: 'Kozhikode', date: addDays(today(), -2), assignedTo: 'e6', teamIds: ['e7'], status: 'Completed', notes: 'Hardscape area marked out with the association secretary.' },
  { id: 'sv5', leadId: 'l8', location: 'Varkala', coords: { lat: 8.7379, lng: 76.7163 }, date: addDays(today(), -20), assignedTo: 'e2', status: 'Cancelled', notes: 'Client postponed, later lost.' },
]

const BOQ_ALL = CHECKLISTS.BOQ.map((i) => i.id)
const QUOTATION_ALL = CHECKLISTS.Quotation.map((i) => i.id)

/** Checklist items already ticked on a seeded project. */
function ticks(ids: string[], by: string): Record<string, ChecklistTick> {
  return Object.fromEntries(ids.map((id, i) => [id, { done: true, by, on: addDays(today(), -40 + i * 2) }]))
}

/**
 * The three worked examples from the structure document, seeded so the client
 * recognises their own numbers: 45% design-only, 55% execution-only, 82% both.
 */
export const projects: Project[] = [
  {
    id: 'p1', code: 'LS-2026-001', name: 'Residence Landscape Design', clientId: 'c1',
    siteLocation: 'Kowdiar, Thiruvananthapuram', projectManagerId: 'e3',
    startDate: '2026-05-01', expectedCompletion: '2026-09-30', status: 'In Progress',
    services: { design: true, execution: false },
    design: { concept: phase(true, 100), threeD: phase(true, 80), civilWork: phase(true, 0), boq: phase(true, 0) },
    execution: { hardscape: phase(false), softscape: phase(false), mep: { enabled: false, progress: 0, services: { irrigation: false, electrical: false, drainage: false } }, maintenance: phase(false) },
    value: 850000, delayed: false,
    siteCoords: { lat: 8.5241, lng: 76.9606 }, checklist: ticks(['boq.measure', 'boq.quantities'], 'e3'),
  },
  {
    id: 'p2', code: 'LS-2026-002', name: 'Villa Landscape Execution', clientId: 'c2',
    siteLocation: 'Panampilly Nagar, Kochi', projectManagerId: 'e7',
    startDate: '2026-06-01', expectedCompletion: '2026-10-15', status: 'In Progress',
    services: { design: false, execution: true },
    design: { concept: phase(false), threeD: phase(false), civilWork: phase(false), boq: phase(false) },
    execution: {
      hardscape: phase(true, 100), softscape: phase(true, 65),
      mep: { enabled: true, progress: 0, services: { irrigation: true, electrical: true, drainage: false } },
      maintenance: phase(true, 0),
    },
    value: 2400000, delayed: false,
    siteCoords: { lat: 9.9580, lng: 76.2950 }, checklist: ticks(QUOTATION_ALL, 'e8'),
  },
  {
    id: 'p3', code: 'LS-2026-003', name: 'Resort Landscape', clientId: 'c3',
    siteLocation: 'Kovalam, Thiruvananthapuram', projectManagerId: 'e7',
    startDate: '2026-04-15', expectedCompletion: '2026-11-30', status: 'In Progress',
    services: { design: true, execution: true },
    design: { concept: phase(true, 100), threeD: phase(true, 100), civilWork: phase(true, 100), boq: phase(true, 100) },
    execution: {
      hardscape: phase(true, 90), softscape: phase(true, 70), mep: { enabled: true, progress: 35, services: { irrigation: true, electrical: true, drainage: true } },
      maintenance: phase(true, 0),
    },
    value: 8600000, delayed: false,
    siteCoords: { lat: 8.4004, lng: 76.9787 }, checklist: ticks([...BOQ_ALL, ...QUOTATION_ALL], 'e3'),
  },
  {
    id: 'p4', code: 'LS-2026-004', name: 'Edava Residence Garden', clientId: 'c4',
    siteLocation: 'എടവ, Varkala', projectManagerId: 'e7',
    startDate: '2026-07-01', expectedCompletion: '2026-09-15', status: 'In Progress',
    services: { design: false, execution: true },
    design: { concept: phase(false), threeD: phase(false), civilWork: phase(false), boq: phase(false) },
    execution: {
      hardscape: phase(true, 100), softscape: phase(true, 45),
      mep: { enabled: true, progress: 60, services: { irrigation: true, electrical: false, drainage: false } },
      maintenance: phase(true, 0),
    },
    value: 1150000, delayed: true,
    siteCoords: { lat: 8.7650, lng: 76.6960 }, checklist: ticks(QUOTATION_ALL, 'e8'),
  },
  {
    id: 'p5', code: 'LS-2026-005', name: 'Greenfield Common Areas', clientId: 'c5',
    siteLocation: 'Kozhikode', projectManagerId: 'e7',
    startDate: '2026-06-20', expectedCompletion: '2026-10-30', status: 'In Progress',
    services: { design: true, execution: true },
    design: { concept: phase(true, 100), threeD: phase(true, 100), civilWork: phase(true, 60), boq: phase(true, 40) },
    execution: {
      hardscape: phase(true, 55), softscape: phase(true, 20), mep: { enabled: false, progress: 0, services: { irrigation: false, electrical: false, drainage: false } },
      maintenance: phase(false),
    },
    value: 3200000, delayed: true,
    siteCoords: { lat: 11.2588, lng: 75.7804 }, checklist: ticks(['boq.measure', 'boq.quantities', 'boq.specs', 'qt.scope', 'qt.survey'], 'e3'),
  },
  {
    id: 'p6', code: 'LS-2026-006', name: 'Kovalam Villa Concept', clientId: 'c3',
    siteLocation: 'Kovalam', projectManagerId: 'e3',
    startDate: '2026-08-01', expectedCompletion: '2026-10-20', status: 'Planning',
    services: { design: true, execution: false },
    design: { concept: phase(true, 40), threeD: phase(true, 0), civilWork: phase(false), boq: phase(true, 0) },
    execution: { hardscape: phase(false), softscape: phase(false), mep: { enabled: false, progress: 0, services: { irrigation: false, electrical: false, drainage: false } }, maintenance: phase(false) },
    value: 420000, delayed: false,
    siteCoords: { lat: 8.3930, lng: 76.9820 }, checklist: ticks(['boq.measure'], 'e3'),
  },
  {
    id: 'p7', code: 'LS-2025-018', name: 'Sea Breeze Villa', clientId: 'c2',
    siteLocation: 'Fort Kochi', projectManagerId: 'e7',
    startDate: '2025-11-01', expectedCompletion: '2026-06-30', status: 'Completed',
    services: { design: true, execution: true, amc: true },
    design: { concept: phase(true, 100), threeD: phase(true, 100), civilWork: phase(true, 100), boq: phase(true, 100) },
    execution: {
      hardscape: phase(true, 100), softscape: phase(true, 100), mep: { enabled: true, progress: 100, services: { irrigation: true, electrical: true, drainage: true } },
      maintenance: phase(true, 40),
    },
    value: 5400000, delayed: false,
    siteCoords: { lat: 9.9658, lng: 76.2421 }, checklist: ticks([...BOQ_ALL, ...QUOTATION_ALL], 'e8'),
  },
  {
    id: 'p8', code: 'LS-2026-007', name: 'Cyber Park Softscape', clientId: 'c5',
    siteLocation: 'Kozhikode', projectManagerId: 'e7',
    startDate: '2026-08-10', expectedCompletion: '2026-12-15', status: 'In Progress',
    services: { design: false, execution: true },
    design: { concept: phase(false), threeD: phase(false), civilWork: phase(false), boq: phase(false) },
    execution: {
      hardscape: phase(false), softscape: phase(true, 30),
      mep: { enabled: true, progress: 10, services: { irrigation: true, electrical: false, drainage: true } },
      maintenance: phase(true, 0),
    },
    value: 1900000, delayed: false,
    siteCoords: { lat: 11.2470, lng: 75.8330 }, checklist: ticks(['qt.scope', 'qt.survey', 'qt.pricing', 'qt.terms'], 'e8'),
  },
  {
    // Sold as an AMC alone — no design or execution by us.
    id: 'p9', code: 'LS-2026-008', name: 'Marine Drive Towers — Garden AMC', clientId: 'c6',
    siteLocation: 'Marine Drive, Kochi', projectManagerId: 'e6',
    startDate: addDays(today(), -45), expectedCompletion: addDays(today(), 319), status: 'In Progress',
    services: { design: false, execution: false, amc: true },
    design: { concept: phase(false), threeD: phase(false), civilWork: phase(false), boq: phase(false) },
    execution: { hardscape: phase(false), softscape: phase(false), mep: { enabled: false, progress: 0, services: { irrigation: false, electrical: false, drainage: false } }, maintenance: phase(false) },
    value: 180000, delayed: false,
    siteCoords: { lat: 9.9816, lng: 76.2756 }, checklist: ticks(QUOTATION_ALL, 'e8'),
  },
]

/** Foreman → site assignments. Ashiq runs Edava, Niyas Kozhikode and Kovalam,
 *  Shihab Kochi — matching the document's example report table. */
export const siteAssignments: SiteAssignment[] = [
  { foremanId: 'e11', projectId: 'p4' },
  { foremanId: 'e11', projectId: 'p2' },
  { foremanId: 'e12', projectId: 'p5' },
  { foremanId: 'e12', projectId: 'p3' },
  { foremanId: 'e13', projectId: 'p8' },
  { foremanId: 'e13', projectId: 'p2' },
]

export const tasks: Task[] = [
  { id: 't1', projectId: 'p1', phase: 'threeD', title: 'Render rear garden views', assigneeId: 'e4', status: 'In Progress', priority: 'High', dueDate: addDays(today(), 3) },
  { id: 't2', projectId: 'p1', phase: 'civilWork', title: 'Prepare civil drawings for pergola', assigneeId: 'e5', status: 'To Do', priority: 'Medium', dueDate: addDays(today(), 9) },
  { id: 't3', projectId: 'p1', phase: 'boq', title: 'Draft BOQ from approved concept', assigneeId: 'e3', status: 'To Do', priority: 'Medium', dueDate: addDays(today(), 14) },
  { id: 't4', projectId: 'p3', phase: 'hardscape', title: 'Complete pool deck paving', assigneeId: 'e7', status: 'In Progress', priority: 'High', dueDate: addDays(today(), 5) },
  { id: 't5', projectId: 'p3', phase: 'mep', title: 'Irrigation trunk line layout', assigneeId: 'e7', status: 'In Progress', priority: 'High', dueDate: addDays(today(), 7) },
  { id: 't6', projectId: 'p4', phase: 'softscape', title: 'Plant remaining ground cover', assigneeId: 'e7', status: 'To Do', priority: 'High', dueDate: addDays(today(), 1) },
  { id: 't7', projectId: 'p5', phase: 'civilWork', title: 'Revise civil drawing per association feedback', assigneeId: 'e5', status: 'Review', priority: 'High', dueDate: addDays(today(), 2) },
  { id: 't8', projectId: 'p5', phase: 'hardscape', title: 'Walkway kerb casting', assigneeId: 'e7', status: 'In Progress', priority: 'Medium', dueDate: addDays(today(), 6) },
  { id: 't9', projectId: 'p6', phase: 'concept', title: 'Concept mood board', assigneeId: 'e4', status: 'In Progress', priority: 'Medium', dueDate: addDays(today(), 4) },
  { id: 't10', projectId: 'p2', phase: 'softscape', title: 'Source native palm varieties', assigneeId: 'e6', status: 'To Do', priority: 'Low', dueDate: addDays(today(), 12) },
  { id: 't11', projectId: 'p2', phase: 'hardscape', title: 'Snag list — driveway edging', assigneeId: 'e7', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -3) },
  { id: 't12', projectId: 'p8', phase: 'softscape', title: 'Soil testing at block C', assigneeId: 'e7', status: 'To Do', priority: 'Medium', dueDate: addDays(today(), 8) },
  { id: 't13', projectId: 'p3', phase: 'boq', title: 'Final BOQ reconciliation', assigneeId: 'e3', status: 'Done', priority: 'High', dueDate: addDays(today(), -10) },
  { id: 't14', projectId: 'p1', phase: 'concept', title: 'Client concept walkthrough', assigneeId: 'e3', status: 'Done', priority: 'High', dueDate: addDays(today(), -8) },
  // Ashfaq's own work — the lead responsibility stays with him.
  { id: 't15', projectId: 'p3', title: 'Approve resort hardscape payment milestone', assigneeId: 'e1', status: 'To Do', priority: 'High', dueDate: addDays(today(), 1) },
  { id: 't16', projectId: 'p5', title: 'Call Greenfield association about the delay', assigneeId: 'e1', status: 'To Do', priority: 'High', dueDate: addDays(today(), 2) },
  { id: 't17', projectId: 'p6', title: 'Close Kovalam villa concept quotation', assigneeId: 'e1', status: 'In Progress', priority: 'Medium', dueDate: addDays(today(), 5) },
  // Accounts and marketing
  { id: 't18', projectId: 'p3', title: 'Raise invoice for hardscape milestone', assigneeId: 'e8', status: 'To Do', priority: 'High', dueDate: addDays(today(), 2) },
  { id: 't19', projectId: 'p2', title: 'Reconcile July client payments', assigneeId: 'e9', status: 'In Progress', priority: 'Medium', dueDate: addDays(today(), 4) },
  { id: 't20', projectId: 'p1', title: 'Follow up Lakeview Villas after site visit', assigneeId: 'e10', status: 'To Do', priority: 'High', dueDate: addDays(today(), 3) },
  { id: 't21', projectId: 'p1', title: 'Prepare Instagram case study for ABC residence', assigneeId: 'e10', status: 'To Do', priority: 'Low', dueDate: addDays(today(), 9) },
  // Execution leadership
  { id: 't22', projectId: 'p4', title: 'Review Edava delay recovery plan', assigneeId: 'e6', status: 'In Progress', priority: 'High', dueDate: addDays(today(), 2) },
  { id: 't23', projectId: 'p7', title: 'Schedule September AMC visits', assigneeId: 'e6', status: 'To Do', priority: 'Medium', dueDate: addDays(today(), 6) },
  // Completed backlog, so progress and the task board read like a live practice.
  { id: 'td1', projectId: 'p1', phase: 'concept', title: 'Site survey and measurement', assigneeId: 'e4', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -12) },
  { id: 'td2', projectId: 'p1', phase: 'concept', title: 'Client brief workshop', assigneeId: 'e3', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -13) },
  { id: 'td3', projectId: 'p1', phase: 'concept', title: 'Concept option A', assigneeId: 'e4', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -14) },
  { id: 'td4', projectId: 'p1', phase: 'concept', title: 'Concept option B', assigneeId: 'e5', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -15) },
  { id: 'td5', projectId: 'p2', phase: 'hardscape', title: 'Driveway sub-base', assigneeId: 'e7', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -16) },
  { id: 'td6', projectId: 'p2', phase: 'hardscape', title: 'Boundary wall cladding', assigneeId: 'e7', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -17) },
  { id: 'td7', projectId: 'p2', phase: 'hardscape', title: 'Paving to front court', assigneeId: 'e7', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -18) },
  { id: 'td8', projectId: 'p2', phase: 'softscape', title: 'Topsoil delivery and spread', assigneeId: 'e7', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -19) },
  { id: 'td9', projectId: 'p3', phase: 'concept', title: 'Resort masterplan concept', assigneeId: 'e4', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -20) },
  { id: 'td10', projectId: 'p3', phase: 'threeD', title: 'Aerial 3D views', assigneeId: 'e5', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -21) },
  { id: 'td11', projectId: 'p3', phase: 'threeD', title: 'Pool area walkthrough', assigneeId: 'e4', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -22) },
  { id: 'td12', projectId: 'p3', phase: 'civilWork', title: 'Pool deck structural detail', assigneeId: 'e5', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -23) },
  { id: 'td13', projectId: 'p3', phase: 'civilWork', title: 'Retaining wall drawings', assigneeId: 'e5', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -24) },
  { id: 'td14', projectId: 'p3', phase: 'hardscape', title: 'Entrance plaza paving', assigneeId: 'e7', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -25) },
  { id: 'td15', projectId: 'p3', phase: 'hardscape', title: 'Pathway kerbing', assigneeId: 'e7', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -26) },
  { id: 'td16', projectId: 'p4', phase: 'hardscape', title: 'Garden wall construction', assigneeId: 'e7', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -27) },
  { id: 'td17', projectId: 'p4', phase: 'hardscape', title: 'Stepping stone path', assigneeId: 'e7', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -28) },
  { id: 'td18', projectId: 'p4', phase: 'softscape', title: 'Bed preparation', assigneeId: 'e7', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -29) },
  { id: 'td19', projectId: 'p5', phase: 'concept', title: 'Common area concept', assigneeId: 'e4', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -30) },
  { id: 'td20', projectId: 'p5', phase: 'threeD', title: 'Clubhouse garden 3D', assigneeId: 'e5', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -31) },
  { id: 'td21', projectId: 'p5', phase: 'threeD', title: 'Walkway visualisation', assigneeId: 'e4', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -32) },
  { id: 'td22', projectId: 'p7', phase: 'softscape', title: 'Final planting', assigneeId: 'e7', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -33) },
  { id: 'td23', projectId: 'p7', phase: 'softscape', title: 'Lawn laying', assigneeId: 'e7', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -34) },
  { id: 'td24', projectId: 'p7', phase: 'mep', title: 'Irrigation commissioning', assigneeId: 'e7', status: 'Done', priority: 'Medium', dueDate: addDays(today(), -35) },
]

const present = (ids: string[], all: string[], checkIn = '10:00', checkOut = '15:40') =>
  all.map((workerId) => ({
    workerId,
    present: ids.includes(workerId),
    checkIn: ids.includes(workerId) ? checkIn : undefined,
    checkOut: ids.includes(workerId) ? checkOut : undefined,
  }))

const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? ''

/** A foreman's morning and evening site photographs for one report. */
function sitePhotos(
  reportId: string, projectId: string, date: string,
  shots: { session: PhotoSession; time: string; caption: string }[],
): ReportPhoto[] {
  return shots.map((shot, i) => ({
    id: `${reportId}-ph${i + 1}`,
    src: placeholderSitePhoto(`${projectId}${date}${shot.session}${i}`, projectName(projectId), shot.session, shot.time),
    caption: shot.caption,
    session: shot.session,
    takenAt: shot.time,
  }))
}

/**
 * Today's site reports, matching the document's example table:
 * Edava / Ashiq / 1 / Planting / Submitted
 * Kozhikode / Niyas / 6 / Hardscape / Approved
 * Kochi / Shihab / 4 / Lawn work / Pending
 */
const recentReports: DailyWorkReport[] = [
  {
    id: 'r1', projectId: 'p4', siteLocation: 'എടവ', date: today(), foremanId: 'e11',
    attendance: present(['w1'], ['w1', 'w6', 'w8', 'w11']),
    startTime: '10:00', endTime: '15:40', otHours: 0,
    workDone: ['Soil preparation completed', '25 plants planted', 'Lawn area levelled'],
    issues: ['Nothing'],
    nextDayPlan: ['Continue planting in the rear garden', 'Begin drip line layout'],
    ta: [{ workerId: 'w1', distanceKm: 12 }],
    photos: sitePhotos('r1', 'p4', today(), [
      { session: 'Morning', time: '09:52', caption: 'Rear garden before planting' },
      { session: 'Evening', time: '15:35', caption: '25 plants in, lawn levelled' },
    ]),
    status: 'Submitted', submittedAt: '16:15', submittedBy: 'e11',
  },
  {
    id: 'r2', projectId: 'p5', siteLocation: 'Kozhikode', date: today(), foremanId: 'e12',
    attendance: present(['w2', 'w4', 'w5', 'w8', 'w11', 'w13'], ['w2', 'w4', 'w5', 'w8', 'w11', 'w13'], '09:00', '17:00'),
    startTime: '09:00', endTime: '17:00', otHours: 1,
    workDone: ['Walkway kerb casting — 40 running metres', 'Paver base compaction at block B'],
    issues: ['Nothing'],
    nextDayPlan: ['Continue kerb casting', 'Paver laying at block B'],
    ta: [{ workerId: 'w2', distanceKm: 8 }, { workerId: 'w4', distanceKm: 15 }],
    photos: sitePhotos('r2', 'p5', today(), [
      { session: 'Morning', time: '08:48', caption: 'Kerb line set out' },
      { session: 'Morning', time: '08:55', caption: 'Block B sub-base' },
      { session: 'Evening', time: '16:52', caption: '40 m of kerb cast' },
    ]),
    status: 'Approved', submittedAt: '17:20', submittedBy: 'e12',
    reviewedAt: '18:05', reviewedBy: 'e7', reviewNote: 'Good progress. Keep the kerb line true to the drawing.',
  },
  {
    // Still a draft: the morning photo is in, the evening one is still to come.
    id: 'r3', projectId: 'p8', siteLocation: 'Kochi', date: today(), foremanId: 'e13',
    attendance: present(['w3', 'w6', 'w14', 'w7'], ['w3', 'w6', 'w14', 'w7', 'w20'], '09:30', '16:30'),
    startTime: '09:30', endTime: '16:30', otHours: 0,
    workDone: ['Lawn work — levelling and grading at the front lawn'],
    issues: [],
    nextDayPlan: ['Lay lawn turf if the material arrives'],
    ta: [{ workerId: 'w3', distanceKm: 20 }],
    photos: sitePhotos('r3', 'p8', today(), [
      { session: 'Morning', time: '09:24', caption: 'Front lawn before grading' },
    ]),
    status: 'Draft',
  },
  {
    id: 'r4', projectId: 'p4', siteLocation: 'എടവ', date: addDays(today(), -1), foremanId: 'e11',
    attendance: present(['w1', 'w6', 'w8'], ['w1', 'w6', 'w8', 'w11']),
    startTime: '10:00', endTime: '16:00', otHours: 0,
    workDone: ['Marked out planting beds', 'Removed construction debris'],
    issues: ['Water connection at the site was cut off for two hours'],
    nextDayPlan: ['Soil preparation', 'Start planting'],
    ta: [{ workerId: 'w1', distanceKm: 12 }],
    photos: sitePhotos('r4', 'p4', addDays(today(), -1), [
      { session: 'Morning', time: '09:41', caption: 'Debris before clearing' },
      { session: 'Evening', time: '15:58', caption: 'Planting beds marked out' },
    ]),
    status: 'Approved', submittedAt: '16:30', submittedBy: 'e11',
    reviewedAt: '17:10', reviewedBy: 'e7', reviewNote: 'Noted. Raised the water supply issue with the client.',
  },
  {
    id: 'r5', projectId: 'p3', siteLocation: 'Kovalam', date: addDays(today(), -1), foremanId: 'e12',
    attendance: present(['w2', 'w5', 'w9', 'w10'], ['w2', 'w5', 'w9', 'w10']),
    startTime: '08:30', endTime: '17:30', otHours: 2,
    workDone: ['Pool deck paving — 60% complete', 'Irrigation trench excavation'],
    issues: ['Paver delivery short by 200 units, supplier notified'],
    nextDayPlan: ['Complete pool deck paving', 'Lay irrigation trunk line'],
    ta: [{ workerId: 'w2', distanceKm: 25 }, { workerId: 'w5', distanceKm: 25 }],
    photos: sitePhotos('r5', 'p3', addDays(today(), -1), [
      { session: 'Morning', time: '08:20', caption: 'Pool deck — paving starts' },
      { session: 'Evening', time: '17:22', caption: 'Pool deck at 60%' },
      { session: 'Evening', time: '17:25', caption: 'Irrigation trench' },
    ]),
    status: 'Approved', submittedAt: '18:00', submittedBy: 'e12',
    reviewedAt: '19:00', reviewedBy: 'e7',
  },
  {
    id: 'r6', projectId: 'p3', siteLocation: 'Kovalam', date: today(), foremanId: 'e12',
    attendance: present(['w9', 'w10', 'w15', 'w16', 'w17'], ['w9', 'w10', 'w15', 'w16', 'w17'], '08:30', '17:30'),
    startTime: '08:30', endTime: '17:30', otHours: 1,
    workDone: ['Pool deck paving completed', 'Irrigation trunk line laid to zone 3'],
    issues: ['Nothing'],
    nextDayPlan: ['Begin planting to the entrance beds', 'Pressure-test irrigation zone 3'],
    ta: [{ workerId: 'w9', distanceKm: 25 }, { workerId: 'w15', distanceKm: 22 }],
    photos: sitePhotos('r6', 'p3', today(), [
      { session: 'Morning', time: '08:24', caption: 'Pool deck — last section' },
      { session: 'Evening', time: '17:18', caption: 'Pool deck complete' },
      { session: 'Evening', time: '17:21', caption: 'Zone 3 trunk line' },
    ]),
    status: 'Approved', submittedAt: '17:55', submittedBy: 'e12',
    reviewedAt: '18:40', reviewedBy: 'e7',
  },
  {
    id: 'r7', projectId: 'p2', siteLocation: 'Panampilly Nagar, Kochi', date: today(), foremanId: 'e13',
    attendance: present(['w18', 'w19', 'w20'], ['w18', 'w19', 'w20'], '09:00', '16:30'),
    startTime: '09:00', endTime: '16:30', otHours: 0,
    workDone: ['Softscape bed preparation at the rear garden', 'Palm pit excavation'],
    issues: ['Nothing'],
    nextDayPlan: ['Set out palms per the planting drawing'],
    ta: [{ workerId: 'w18', distanceKm: 18 }],
    photos: sitePhotos('r7', 'p2', today(), [
      { session: 'Morning', time: '08:57', caption: 'Rear garden beds' },
      { session: 'Evening', time: '16:24', caption: 'Palm pits ready' },
    ]),
    status: 'Submitted', submittedAt: '16:50', submittedBy: 'e13',
  },
]

/**
 * Two weeks of approved reports behind today's, so attendance, the gallery
 * and each worker's history have something to show. Each foreman alternates
 * between their two sites, and each site keeps its own crew so no worker is
 * ever in two places on one day.
 */
const ROTATION: { foremanId: string; even: string; odd: string; crews: Record<string, string[]> }[] = [
  { foremanId: 'e11', even: 'p4', odd: 'p2', crews: { p4: ['w1', 'w8', 'w11', 'w6'], p2: ['w1', 'w18', 'w19', 'w20', 'w7'] } },
  { foremanId: 'e12', even: 'p5', odd: 'p3', crews: { p5: ['w2', 'w4', 'w5', 'w13'], p3: ['w2', 'w9', 'w10', 'w15', 'w16', 'w17'] } },
  { foremanId: 'e13', even: 'p2', odd: 'p8', crews: { p2: ['w3', 'w18', 'w19', 'w20', 'w7'], p8: ['w3', 'w6', 'w14', 'w8', 'w11'] } },
]

const WORK_LINES: Record<string, string[]> = {
  p2: ['Driveway edging snags cleared', 'Palm pits marked and excavated', 'Topsoil spread at the rear garden', 'Boundary hedge planting'],
  p3: ['Pool deck paving continued', 'Irrigation trench excavation', 'Entrance plaza joints grouted', 'Retaining wall coping fixed'],
  p4: ['Garden wall plastering', 'Stepping stone path laid', 'Planting bed preparation', 'Ground cover planting'],
  p5: ['Walkway kerb casting', 'Paver base compaction', 'Clubhouse lawn levelling', 'Storm drain chamber cast'],
  p8: ['Soil testing at block C', 'Drainage line trenching', 'Shrub planting along the spine road', 'Lawn grading at the entrance'],
}

const ISSUE_LINES = [
  'Rain stopped work for an hour after lunch',
  'Cement delivery arrived two hours late',
  'Client asked to hold the bed layout until their visit',
]


const isWorkday = (date: string) =>
  new Date(date + 'T00:00:00').getDay() !== 0 && !HOLIDAYS.includes(date)

const historicReports: DailyWorkReport[] = Array.from({ length: 13 }, (_, i) => addDays(today(), -(i + 2)))
  .filter(isWorkday)
  .flatMap((date) => {
    const parity = new Date(date + 'T00:00:00').getDate() % 2
    return ROTATION.map(({ foremanId, even, odd, crews }): DailyWorkReport => {
      const projectId = parity === 0 ? even : odd
      const crew = crews[projectId]
      const h = hash(projectId + date)
      // The foreman's own crew member is always there; others miss the odd day.
      const here = crew.filter((w, i) => i === 0 || hash(w + date) % 100 >= 12)
      const start = ['08:30', '09:00', '09:30'][h % 3]
      const end = ['16:30', '17:00', '17:30'][(h >>> 2) % 3]
      const lines = WORK_LINES[projectId]
      const issue = h % 7 === 0 ? ISSUE_LINES[h % ISSUE_LINES.length] : 'Nothing'
      const id = `rh-${projectId}-${date}`
      const project = projects.find((p) => p.id === projectId)!
      return {
        id, projectId, siteLocation: project.siteLocation, date, foremanId,
        attendance: present(here, crew, start, end),
        startTime: start, endTime: end, otHours: h % 5 === 0 ? 1 : 0,
        workDone: [lines[h % lines.length], lines[(h + 1) % lines.length]],
        issues: [issue],
        nextDayPlan: [lines[(h + 2) % lines.length]],
        ta: [{ workerId: crew[0], distanceKm: 8 + (h % 20) }],
        photos: sitePhotos(id, projectId, date, [
          { session: 'Morning', time: `08:${String(10 + (h % 40)).padStart(2, '0')}`, caption: 'Start of day' },
          ...(h % 3 === 0 ? [{ session: 'Morning' as const, time: `08:${String(52 + (h % 7)).padStart(2, '0')}`, caption: lines[h % lines.length] }] : []),
          { session: 'Evening', time: `${end.slice(0, 2)}:${String(5 + (h % 20)).padStart(2, '0')}`, caption: 'End of day' },
        ]),
        status: 'Approved',
        submittedAt: end, submittedBy: foremanId,
        reviewedAt: '19:00', reviewedBy: 'e7',
      }
    })
  })

export const reports: DailyWorkReport[] = [...recentReports, ...historicReports]

export const issues: Issue[] = [
  { id: 'i1', projectId: 'p4', reportId: 'r4', text: 'Water connection at the site was cut off for two hours', raisedBy: 'e11', assignedTo: 'e7', date: addDays(today(), -1), status: 'Resolved' },
  { id: 'i2', projectId: 'p3', reportId: 'r5', text: 'Paver delivery short by 200 units, supplier notified', raisedBy: 'e12', assignedTo: 'e7', date: addDays(today(), -1), status: 'Open' },
  { id: 'i3', projectId: 'p5', reportId: 'r2', text: 'Association requested a change to the walkway alignment', raisedBy: 'e12', assignedTo: 'e7', date: addDays(today(), -2), status: 'Open' },
]

export const quotations: Quotation[] = [
  { id: 'q1', kind: 'BOQ', number: 'BOQ-2026-011', projectId: 'p1', clientId: 'c1', date: '2026-04-20', status: 'Accepted', items: [{ description: 'Concept design', quantity: 1, unit: 'LS', rate: 425000 }, { description: '3D presentation', quantity: 1, unit: 'LS', rate: 170000 }, { description: 'Civil drawings', quantity: 1, unit: 'LS', rate: 127500 }, { description: 'BOQ preparation', quantity: 1, unit: 'LS', rate: 127500 }] },
  { id: 'q2', kind: 'Quotation', number: 'QT-2026-014', projectId: 'p2', clientId: 'c2', date: '2026-05-18', status: 'Accepted', items: [{ description: 'Hardscape works', quantity: 1, unit: 'LS', rate: 1200000 }, { description: 'Softscape works', quantity: 1, unit: 'LS', rate: 850000 }, { description: 'Irrigation and electrical', quantity: 1, unit: 'LS', rate: 350000 }] },
  { id: 'q3', kind: 'BOQ', number: 'BOQ-2026-021', projectId: 'p6', clientId: 'c3', date: '2026-07-28', status: 'Sent', items: [{ description: 'Concept design', quantity: 1, unit: 'LS', rate: 210000 }, { description: '3D presentation', quantity: 1, unit: 'LS', rate: 105000 }, { description: 'BOQ preparation', quantity: 1, unit: 'LS', rate: 105000 }] },
  { id: 'q4', kind: 'Quotation', number: 'QT-2026-023', projectId: 'p8', clientId: 'c5', date: '2026-08-05', status: 'Draft', items: [{ description: 'Campus softscape', quantity: 1, unit: 'LS', rate: 1450000 }, { description: 'Irrigation and drainage', quantity: 1, unit: 'LS', rate: 450000 }] },
  // Design + Execution carries both documents.
  { id: 'q5', kind: 'BOQ', number: 'BOQ-2026-009', projectId: 'p3', clientId: 'c3', date: '2026-04-05', status: 'Accepted', items: [{ description: 'Masterplan concept', quantity: 1, unit: 'LS', rate: 600000 }, { description: '3D presentation', quantity: 1, unit: 'LS', rate: 240000 }, { description: 'Civil and structural drawings', quantity: 1, unit: 'LS', rate: 180000 }] },
  { id: 'q6', kind: 'Quotation', number: 'QT-2026-012', projectId: 'p3', clientId: 'c3', date: '2026-05-02', status: 'Accepted', items: [{ description: 'Hardscape — pool deck and plazas', quantity: 2400, unit: 'sq ft', rate: 1250 }, { description: 'Softscape and planting', quantity: 1, unit: 'LS', rate: 2600000 }, { description: 'MEP — irrigation, lighting, drainage', quantity: 1, unit: 'LS', rate: 1980000 }] },
  { id: 'q7', kind: 'Quotation', number: 'QT-2026-027', projectId: 'p9', clientId: 'c6', date: addDays(today(), -52), status: 'Accepted', items: [{ description: 'Annual maintenance — monthly visits', quantity: 12, unit: 'visit', rate: 12500 }, { description: 'Quarterly seasonal replanting', quantity: 4, unit: 'round', rate: 7500 }] },
]

export const paymentRequests: PaymentRequest[] = [
  { id: 'pr1', projectId: 'p1', phase: 'concept', amount: 425000, requestedBy: 'e3', date: '2026-06-02', status: 'Paid', note: 'Concept approved by client' },
  { id: 'pr2', projectId: 'p1', phase: 'threeD', amount: 170000, requestedBy: 'e3', date: addDays(today(), -4), status: 'Approved', note: '3D presentation delivered' },
  { id: 'pr3', projectId: 'p3', phase: 'hardscape', amount: 1800000, requestedBy: 'e7', date: addDays(today(), -2), status: 'Pending', note: 'Hardscape 90% milestone' },
  { id: 'pr4', projectId: 'p2', phase: 'softscape', amount: 550000, requestedBy: 'e7', date: addDays(today(), -9), status: 'Paid' },
  { id: 'pr5', projectId: 'p5', phase: 'civilWork', amount: 300000, requestedBy: 'e3', date: addDays(today(), -1), status: 'Pending', note: 'Civil drawings 60% complete' },
]

export const payments: Payment[] = [
  { id: 'pay1', projectId: 'p1', clientId: 'c1', amount: 425000, date: '2026-06-08', method: 'Bank Transfer', reference: 'NEFT/2026/44821', requestId: 'pr1' },
  { id: 'pay2', projectId: 'p2', clientId: 'c2', amount: 1200000, date: '2026-06-15', method: 'Bank Transfer', reference: 'RTGS/2026/11204' },
  { id: 'pay3', projectId: 'p2', clientId: 'c2', amount: 550000, date: addDays(today(), -7), method: 'Cheque', reference: 'CHQ 884213', requestId: 'pr4' },
  { id: 'pay4', projectId: 'p3', clientId: 'c3', amount: 3000000, date: '2026-05-30', method: 'Bank Transfer', reference: 'RTGS/2026/09912' },
  { id: 'pay5', projectId: 'p3', clientId: 'c3', amount: 2000000, date: addDays(today(), -15), method: 'Bank Transfer', reference: 'RTGS/2026/13380' },
  { id: 'pay6', projectId: 'p4', clientId: 'c4', amount: 500000, date: '2026-07-05', method: 'UPI', reference: 'UPI/2026/77123' },
]

const AMC_NOTES = [
  'Lawn mowing and edge trimming.',
  'Pruning, weeding and a pest-control round.',
  'Irrigation check — nozzles cleaned, timers reset.',
  'Fertiliser application and bed top-up.',
  'Hedge shaping and dead-head removal.',
]

/**
 * Visits already made on a repeat schedule: every `everyDays` from `first`,
 * up to yesterday. Dates are relative to today so the calendar always has a
 * past, a next visit inside its reminder window, and a future.
 */
function pastVisits(prefix: string, first: string, everyDays: number, teamIds: string[]): MaintenanceVisit[] {
  const out: MaintenanceVisit[] = []
  for (let date = first, i = 0; date < today(); date = addDays(date, everyDays), i += 1) {
    out.push({
      id: `${prefix}${i + 1}`, date, teamIds, notes: AMC_NOTES[i % AMC_NOTES.length],
      issues: i === 2 ? ['Two drip emitters blocked, replaced.'] : [], photoCount: 3 + (i % 4), done: true,
    })
  }
  return out
}

const seaBreezeStart = addDays(today(), -69)
const marineStart = addDays(today(), -45)

export const maintenance: MaintenanceRecord[] = [
  {
    id: 'm1', projectId: 'p7', type: 'Free Maintenance', startDate: '2026-07-01', endDate: '2026-07-31',
    teamIds: ['w6', 'w7'], scopeOfWork: 'Weekly plant care, lawn mowing, irrigation checks and snag rectification.',
    visitSchedule: 'Weekly — every Tuesday',
    schedule: { every: 1, unit: 'week', firstVisit: '2026-07-07', reminderDaysBefore: 1 },
    visits: [
      { id: 'mv1', date: '2026-07-07', teamIds: ['w6', 'w7'], notes: 'Lawn mowing and first fertiliser round.', issues: [], photoCount: 4, done: true },
      { id: 'mv2', date: '2026-07-14', teamIds: ['w6'], notes: 'Pruning and irrigation nozzle check.', issues: ['Two drip emitters blocked, replaced.'], photoCount: 3, done: true },
      { id: 'mv3', date: '2026-07-21', teamIds: ['w6', 'w7'], notes: 'Lawn mowing, weed removal.', issues: [], photoCount: 5, done: true },
      { id: 'mv4', date: '2026-07-28', teamIds: ['w6'], notes: 'Final free-maintenance visit and handover walkthrough.', issues: [], photoCount: 6, done: true },
    ],
  },
  {
    id: 'm2', projectId: 'p7', type: 'AMC', startDate: seaBreezeStart, endDate: addDays(seaBreezeStart, 364),
    teamIds: ['w6', 'w7'], scopeOfWork: 'Fortnightly plant health care, lawn maintenance, irrigation servicing, seasonal replanting and pest control.',
    visitSchedule: 'Fortnightly — client prefers mornings',
    schedule: { every: 2, unit: 'week', firstVisit: addDays(seaBreezeStart, 3), reminderDaysBefore: 7 },
    renewalDate: addDays(seaBreezeStart, 364), renewalReminderDays: 60, value: 240000,
    visits: pastVisits('m2v', addDays(seaBreezeStart, 3), 14, ['w6', 'w7']),
  },
  {
    // An AMC sold on its own — monthly visits, reminded three days ahead.
    id: 'm3', projectId: 'p9', type: 'AMC', startDate: marineStart, endDate: addDays(marineStart, 364),
    teamIds: ['w14', 'w18'], scopeOfWork: 'Monthly upkeep of the podium garden, terrace planters and common-area lawns, with quarterly replanting.',
    visitSchedule: 'Monthly — association office opens at 9:30',
    schedule: { every: 1, unit: 'month', firstVisit: addDays(marineStart, 5), reminderDaysBefore: 3 },
    renewalDate: addDays(marineStart, 364), renewalReminderDays: 45, value: 180000,
    visits: [
      { id: 'm3v1', date: addDays(marineStart, 5), teamIds: ['w14', 'w18'], notes: 'First visit — full survey of the podium and terraces.', issues: ['Terrace planter drainage blocked on 7th floor.'], photoCount: 9, done: true },
    ],
  },
]

export const documents: DocumentRecord[] = [
  { id: 'd1', name: 'ABC Residence — Concept Presentation.pdf', projectId: 'p1', category: 'Drawing', uploadedBy: 'e4', uploadedAt: addDays(today(), -30), sizeKb: 8420 },
  { id: 'd2', name: 'ABC Residence — 3D Views R2.pdf', projectId: 'p1', category: 'Drawing', uploadedBy: 'e4', uploadedAt: addDays(today(), -5), sizeKb: 15300 },
  { id: 'd3', name: 'Resort Landscape — BOQ Final.xlsx', projectId: 'p3', category: 'BOQ', uploadedBy: 'e3', uploadedAt: addDays(today(), -12), sizeKb: 340 },
  { id: 'd4', name: 'XYZ Estates — Signed Contract.pdf', projectId: 'p2', category: 'Contract', uploadedBy: 'e8', uploadedAt: addDays(today(), -60), sizeKb: 1200 },
  { id: 'd5', name: 'Edava — Site Photos 28-08.zip', projectId: 'p4', category: 'Photo', uploadedBy: 'e11', uploadedAt: addDays(today(), -1), sizeKb: 24800 },
  { id: 'd6', name: 'Greenfield — Civil Drawings R3.dwg', projectId: 'p5', category: 'Drawing', uploadedBy: 'e5', uploadedAt: addDays(today(), -3), sizeKb: 5600 },
  { id: 'd7', name: 'Monthly Execution Summary — July.pdf', category: 'Report', uploadedBy: 'e6', uploadedAt: addDays(today(), -28), sizeKb: 820 },
  { id: 'd8', name: 'Sea Breeze — AMC Agreement.pdf', projectId: 'p7', clientId: 'c2', department: 'AMC', category: 'Contract', uploadedBy: 'e8', uploadedAt: addDays(today(), -29), sizeKb: 960 },
  // Attachments filed on the client record, by department.
  { id: 'd9', name: 'DEF Resorts — Plant palette approval.pdf', projectId: 'p3', clientId: 'c3', department: 'Design', category: 'Drawing', uploadedBy: 'e3', uploadedAt: addDays(today(), -40), sizeKb: 2150 },
  { id: 'd10', name: 'DEF Resorts — Pool deck stone sample photos.zip', projectId: 'p3', clientId: 'c3', department: 'Execution', category: 'Photo', uploadedBy: 'e7', uploadedAt: addDays(today(), -6), sizeKb: 18400 },
  { id: 'd11', name: 'DEF Resorts — Hardscape milestone invoice.pdf', projectId: 'p3', clientId: 'c3', department: 'Accounts', category: 'Other', uploadedBy: 'e8', uploadedAt: addDays(today(), -2), sizeKb: 210 },
  { id: 'd12', name: 'Sea Breeze — August AMC visit report.pdf', projectId: 'p7', clientId: 'c2', department: 'AMC', category: 'Report', uploadedBy: 'e6', uploadedAt: addDays(today(), -12), sizeKb: 640 },
  { id: 'd13', name: 'XYZ Estates — Palm species list from client.xlsx', projectId: 'p2', clientId: 'c2', department: 'Execution', category: 'Other', uploadedBy: 'e7', uploadedAt: addDays(today(), -9), sizeKb: 48 },
]

export const clarifications: Clarification[] = [
  { id: 'cl1', clientId: 'c3', projectId: 'p3', department: 'Design', raisedBy: 'Client', question: 'Can the entrance beds use flowering shrubs instead of ornamental grass?', loggedBy: 'e3', raisedOn: addDays(today(), -35), status: 'Resolved', answer: 'Yes — revised palette with ixora and hibiscus shared and approved.', answeredBy: 'e2', answeredOn: addDays(today(), -33) },
  { id: 'cl2', clientId: 'c3', projectId: 'p3', department: 'Execution', raisedBy: 'Team', question: 'Confirm the pool deck stone finish: flamed or honed?', loggedBy: 'e7', raisedOn: addDays(today(), -6), status: 'Open' },
  { id: 'cl3', clientId: 'c3', projectId: 'p3', department: 'Accounts', raisedBy: 'Client', question: 'Is GST included in the hardscape milestone amount?', loggedBy: 'e8', raisedOn: addDays(today(), -2), status: 'Open' },
  { id: 'cl4', clientId: 'c2', projectId: 'p2', department: 'Execution', raisedBy: 'Team', question: 'Which palm species for the rear garden — Foxtail or Royal?', loggedBy: 'e7', raisedOn: addDays(today(), -10), status: 'Resolved', answer: 'Client chose Foxtail; species list attached.', answeredBy: 'e7', answeredOn: addDays(today(), -9) },
  { id: 'cl5', clientId: 'c2', projectId: 'p7', department: 'AMC', raisedBy: 'Client', question: 'Can AMC visits move from Tuesday to Saturday mornings?', loggedBy: 'e6', raisedOn: addDays(today(), -4), status: 'Open' },
  { id: 'cl6', clientId: 'c1', projectId: 'p1', department: 'Design', raisedBy: 'Client', question: 'Can the pergola be teak rather than WPC?', loggedBy: 'e3', raisedOn: addDays(today(), -3), status: 'Open' },
  { id: 'cl7', clientId: 'c5', projectId: 'p5', department: 'Design', raisedBy: 'Team', question: 'Association to confirm the revised walkway alignment.', loggedBy: 'e5', raisedOn: addDays(today(), -2), status: 'Open' },
]

export const chatMessages: ChatMessage[] = [
  { id: 'ch1', clientId: 'c3', department: 'Design', authorId: 'e2', text: 'Final BOQ is reconciled. Design is done on our side for the resort.', at: `${addDays(today(), -10)}T11:20` },
  { id: 'ch2', clientId: 'c3', department: 'Design', authorId: 'e3', text: 'Sharing the plant palette approval under attachments for the site team.', at: `${addDays(today(), -10)}T11:42` },
  { id: 'ch3', clientId: 'c3', department: 'Execution', authorId: 'e7', text: 'Paver delivery was short by 200 units. Supplier says Thursday.', at: `${addDays(today(), -1)}T17:05` },
  { id: 'ch4', clientId: 'c3', department: 'Execution', authorId: 'e6', text: 'Hold the pool deck edge until the client confirms flamed vs honed.', at: `${addDays(today(), -1)}T17:30` },
  { id: 'ch5', clientId: 'c3', department: 'Execution', authorId: 'e1', text: 'I meet their GM this week — will get the stone finish decided.', at: `${today()}T09:10` },
  { id: 'ch6', clientId: 'c3', department: 'Accounts', authorId: 'e8', text: 'Hardscape milestone request is pending approval. Invoice draft attached.', at: `${addDays(today(), -2)}T15:00` },
  { id: 'ch7', clientId: 'c2', department: 'AMC', authorId: 'e6', text: 'Client wants Saturday visits. Sabu and Manoj are both free Saturday mornings.', at: `${addDays(today(), -4)}T10:15` },
  { id: 'ch8', clientId: 'c2', department: 'Execution', authorId: 'e7', text: 'Palm pits done at Panampilly Nagar. Setting out palms tomorrow.', at: `${today()}T16:55` },
  { id: 'ch9', clientId: 'c1', department: 'Design', authorId: 'e4', text: 'Rear garden renders at 80%. Waiting on the pergola material decision.', at: `${addDays(today(), -2)}T14:30` },
]

export const followUps: PaymentFollowUp[] = [
  { id: 'fu1', clientId: 'c3', projectId: 'p3', date: addDays(today(), -12), mode: 'Call', note: 'Spoke to the GM about the second instalment. Agreed to release after the hardscape milestone.', byId: 'e8', nextFollowUp: addDays(today(), -2) },
  { id: 'fu2', clientId: 'c3', projectId: 'p3', date: addDays(today(), -2), mode: 'Email', note: 'Sent the hardscape milestone invoice draft. Client queried GST.', byId: 'e8', promisedAmount: 1800000, nextFollowUp: addDays(today(), 3) },
  { id: 'fu3', clientId: 'c4', projectId: 'p4', date: addDays(today(), -8), mode: 'WhatsApp', note: 'Reminded about the balance after hardscape. Will pay once softscape is complete.', byId: 'e9', nextFollowUp: addDays(today(), -1) },
  { id: 'fu4', clientId: 'c1', projectId: 'p1', date: addDays(today(), -3), mode: 'Call', note: '3D presentation payment approved. Client confirmed NEFT this week.', byId: 'e9', promisedAmount: 170000, nextFollowUp: addDays(today(), 2) },
  { id: 'fu5', clientId: 'c5', projectId: 'p5', date: addDays(today(), -5), mode: 'Visit', note: 'Met the association treasurer. First advance to follow once the walkway alignment is signed off.', byId: 'e8', nextFollowUp: addDays(today(), 6) },
]

/** Offset from today, nudged off Sunday — the CEO's diary runs Monday to Saturday. */
function workday(offset: number): string {
  const date = addDays(today(), offset)
  return new Date(date + 'T00:00:00').getDay() === 0 ? addDays(date, offset < 0 ? -1 : 1) : date
}

export const consultations: Consultation[] = [
  { id: 'cs1', date: workday(1), start: '10:00', durationMins: 60, purpose: 'Resort pool deck finish and milestone payment', clientId: 'c3', mode: 'Office', bookedBy: 'e7', status: 'Scheduled' },
  { id: 'cs2', date: workday(1), start: '15:00', durationMins: 30, purpose: 'Lakeview Villas — common area proposal walkthrough', leadId: 'l5', mode: 'Video', bookedBy: 'e10', status: 'Scheduled' },
  { id: 'cs3', date: workday(2), start: '11:30', durationMins: 45, purpose: 'Greenfield delay — recovery plan with the association', clientId: 'c5', mode: 'Site', location: 'Greenfield Apartments, Kozhikode', bookedBy: 'e6', status: 'Scheduled',
    postponements: [{ fromDate: workday(1), fromStart: '16:00', toDate: workday(2), toStart: '11:30', reason: 'Association secretary travelling — asked to move it a day', by: 'e6', at: `${addDays(today(), -1)}T10:20` }] },
  { id: 'cs4', date: workday(3), start: '09:30', durationMins: 30, purpose: 'Pergola material decision', clientId: 'c1', mode: 'Site', location: 'Kowdiar, Thiruvananthapuram', bookedBy: 'e3', status: 'Scheduled' },
  { id: 'cs5', date: workday(4), start: '16:00', durationMins: 60, purpose: 'Quarterly accounts review', attendee: 'Arshad, Anaswara', mode: 'Office', bookedBy: 'e8', status: 'Scheduled' },
  { id: 'cs6', date: workday(-2), start: '10:30', durationMins: 60, purpose: 'Terrace garden quotation discussion', leadId: 'l4', mode: 'Office', bookedBy: 'e10', status: 'Completed', notes: 'Client wants a revised quote with fewer planters.' },
  { id: 'cs7', date: workday(-5), start: '14:00', durationMins: 30, purpose: 'AMC renewal terms — Sea Breeze Villa', clientId: 'c2', mode: 'Phone', bookedBy: 'e6', status: 'Completed' },
]

/** Small deterministic hash so generated attendance is stable across reloads. */
function hash(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h
}

/**
 * Sixty days of office attendance for each employee, Sundays and holidays
 * off. Generated rather than hand-written, so it always ends at today. Today
 * is left unmarked for a few people so the register has something to do.
 * Site workers have no rows here — their days come from the daily reports.
 */
export const attendance: AttendanceEntry[] = employees
  .filter((e) => e.role !== 'super_admin')
  .flatMap((employee) =>
    Array.from({ length: 60 }, (_, i) => addDays(today(), -i))
      .filter((date) => isWorkday(date))
      .filter((date) => date !== today() || hash(employee.id) % 4 !== 0)
      .map((date): AttendanceEntry => {
        const roll = hash(employee.id + date) % 100
        const status: StaffAttendanceStatus =
          roll < 3 ? 'Absent' : roll < 8 ? 'Leave' : roll < 12 ? 'Half Day' : 'Present'
        const minute = String(hash(date + employee.id) % 25).padStart(2, '0')
        return {
          kind: 'employee',
          personId: employee.id,
          date,
          status,
          checkIn: status === 'Present' || status === 'Half Day' ? `09:${minute}` : undefined,
          // Today's check-out is still to come.
          checkOut: date === today() ? undefined
            : status === 'Present' ? '18:00' : status === 'Half Day' ? '13:30' : undefined,
          otHours: status === 'Present' && date !== today() && roll > 93 ? 1 + (roll % 2) : undefined,
        }
      }),
  )

/**
 * Deadlines and meetings. Site visits, AMC visits, task due dates and CEO
 * consultations are drawn onto the calendar from their own records.
 */
export const calendarEvents: CalendarEvent[] = [
  { id: 'ce3', title: '3D presentation due — ABC Residence', date: addDays(today(), 3), type: 'Deadline', projectId: 'p1', assigneeId: 'e4' },
  { id: 'ce5', title: 'Edava softscape completion', date: addDays(today(), 1), type: 'Deadline', projectId: 'p4', assigneeId: 'e7' },
  { id: 'ce6', title: 'Weekly execution review', date: addDays(today(), 6), type: 'Meeting', assigneeId: 'e6' },
  { id: 'ce7', title: 'Greenfield association walkthrough', date: addDays(today(), 8), type: 'Meeting', projectId: 'p5', assigneeId: 'e7' },
  { id: 'ce8', title: 'Resort hardscape milestone', date: addDays(today(), 10), type: 'Deadline', projectId: 'p3', assigneeId: 'e7' },
]

/**
 * Defaults for everything the document insists stay configurable. The design
 * payment split shows the 50/20/15/15 example; Settings offers 25/25/25/25 and
 * any other combination totalling 100.
 */
export const settings: Settings = {
  designPaymentSplit: { concept: 50, threeD: 20, civilWork: 15, boq: 15 },
  taEnabled: false,
  taRatePerKm: 0,
  photosMandatory: true,
  photoMaxPx: 1600,
  photoMaxKb: 300,
  otAdjustRoles: ['super_admin', 'ceo', 'execution_head', 'execution_pm'],
  freeMaintenanceMonths: 1,
  permissions: defaultPermissions(),
  holidays: HOLIDAYS,
  workHours: { start: '09:00', end: '18:00', halfDayEnd: '13:30' },
  workerSkills: [
    'Carpenter', 'Driver / Helper', 'Electrician', 'Foreman / Hardscape', 'Foreman / Lawn', 'Foreman / Planting',
    'Gardener', 'Helper', 'Lawn Specialist', 'Mason', 'Painter', 'Plumber / Irrigation', 'Tile & Paver Layer',
    'Welder / Fabricator',
  ],
}

/** Counters shown on the execution dashboard, per the document's example. */
export const executionDashboardSeed = {
  activeSites: 8,
  totalSitesReporting: 8,
  workersToday: 34,
  completedTasks: 27,
}

/** A remark posted `daysAgo` days back at `time`. */
const at = (daysAgo: number, time: string) => `${addDays(today(), -daysAgo)}T${time}`

/** Each project's remarks thread — the team's WhatsApp-style conversation. */
export const projectMessages: ProjectMessage[] = [
  { id: 'pm1', projectId: 'p3', authorId: 'e7', text: 'Pool deck paving starts tomorrow. Niyas, please confirm the paver count at the yard today.', at: at(3, '17:42') },
  { id: 'pm2', projectId: 'p3', authorId: 'e12', text: 'Checked — we are 200 short. Supplier says Thursday.', at: at(3, '18:05') },
  { id: 'pm3', projectId: 'p3', authorId: 'e6', text: 'Start from the shallow end so the gap does not hold up the edge detail.', at: at(3, '18:20') },
  { id: 'pm4', projectId: 'p3', authorId: 'e3', text: 'Edge detail drawing R2 is in Documents — the coping overhang changed to 40 mm.', at: at(2, '10:14') },
  { id: 'pm5', projectId: 'p3', authorId: 'e12', text: 'Noted, will follow R2.', at: at(2, '10:31'), replyToId: 'pm4' },
  { id: 'pm6', projectId: 'p3', authorId: 'e1', text: 'Meeting their GM this week about the flamed vs honed finish. Hold the last 6 m until then.', at: at(1, '09:12') },
  { id: 'pm7', projectId: 'p3', authorId: 'e7', text: 'Done. Crew moves to the irrigation trunk line meanwhile.', at: at(1, '09:30') },
  { id: 'pm8', projectId: 'p3', authorId: 'e12', text: 'Pool deck complete except the held strip. Zone 3 trunk line laid 👍', at: at(1, '17:26') },

  { id: 'pm9', projectId: 'p2', authorId: 'e7', text: 'Client chose Foxtail palms for the rear garden.', at: at(9, '11:05') },
  { id: 'pm10', projectId: 'p2', authorId: 'e13', text: 'Palm pits dug today. Ready to set out tomorrow morning.', at: at(1, '16:58') },
  { id: 'pm11', projectId: 'p2', authorId: 'e6', text: 'Check the root-ball depth before backfilling — some came in shallow last time.', at: at(1, '17:15'), replyToId: 'pm10' },

  { id: 'pm12', projectId: 'p4', authorId: 'e11', text: 'Water connection was off for two hours again. Lost the afternoon watering.', at: at(1, '15:50') },
  { id: 'pm13', projectId: 'p4', authorId: 'e7', text: 'Raised it with Dr. Ramesh — he will speak to the plumber.', at: at(1, '17:10') },
  { id: 'pm14', projectId: 'p4', authorId: 'e1', text: 'We are already past the due date here. Thameem, recovery plan by Monday please.', at: at(0, '08:40') },

  { id: 'pm15', projectId: 'p5', authorId: 'e5', text: 'Revised walkway alignment sent to the association for sign-off.', at: at(2, '12:20') },
  { id: 'pm16', projectId: 'p5', authorId: 'e12', text: 'Holding kerb casting on the north side until they approve.', at: at(2, '12:45') },

  { id: 'pm17', projectId: 'p9', authorId: 'e6', text: 'Next monthly visit coming up — Bijoy and Riyas, carry the planter drainage kit for the 7th floor.', at: at(1, '10:00') },
]

/**
 * Salary and wage payments. Foremen are paid monthly in the first week of the
 * following month, with the odd advance and TA reimbursement; site workers
 * are paid wages every Saturday.
 */
export const payRecords: PayRecord[] = [
  ...employees.filter((e) => e.monthlySalary).flatMap((e): PayRecord[] => {
    const months = [3, 2, 1].map((back) => {
      const d = new Date(today() + 'T00:00:00')
      d.setDate(1)
      d.setMonth(d.getMonth() - back)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
    const paidOn = (period: string) => {
      const [y, m] = period.split('-').map(Number)
      const next = new Date(y, m, 3 + (hash(e.id) % 3))
      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
    }
    return [
      ...months.map((period, i): PayRecord => ({
        id: `pay-${e.id}-${period}`, kind: 'employee', personId: e.id, date: paidOn(period),
        amount: e.monthlySalary! - (i === 1 ? 2000 : 0), type: 'Salary', period, method: 'Bank Transfer',
        note: i === 1 ? 'Advance of ₹2,000 recovered' : undefined, paidBy: 'e8',
      })),
      { id: `adv-${e.id}`, kind: 'employee', personId: e.id, date: addDays(today(), -6), amount: 3000, type: 'Advance', period: today().slice(0, 7), method: 'UPI', note: 'Festival advance', paidBy: 'e9' },
      { id: `ta-${e.id}`, kind: 'employee', personId: e.id, date: addDays(today(), -12), amount: 1150 + (hash(e.id) % 6) * 50, type: 'TA', period: today().slice(0, 7), method: 'Cash', note: 'Site travel, last fortnight', paidBy: 'e9' },
    ]
  }),
  ...workers.filter((w) => w.active && w.dailyWage).flatMap((w) =>
    [1, 2, 3, 4].map((weeksBack): PayRecord => {
      // The Saturday `weeksBack` weeks ago.
      const sat = addDays(today(), -((new Date(today() + 'T00:00:00').getDay() + 1) % 7) - (weeksBack - 1) * 7)
      const days = 4 + (hash(w.id + weeksBack) % 3)
      return {
        id: `wage-${w.id}-${weeksBack}`, kind: 'worker', personId: w.id, date: sat, amount: days * w.dailyWage!,
        type: 'Wages', period: sat.slice(0, 7), method: 'Cash', note: `${days} days`, paidBy: 'e9',
      }
    })),
]

/** Reminders added from the calendar. */
export const reminders: Reminder[] = [
  { id: 'rm1', title: 'Weekly execution review', date: workday(1), time: '17:00', repeat: 'weekly', createdBy: 'e6', forIds: ['e6', 'e7'], doneDates: [], notes: 'Go through each site, delays and next week’s plan.' },
  { id: 'rm2', title: 'Follow up Greenfield association on walkway sign-off', date: today(), time: '11:00', repeat: 'none', createdBy: 'e1', forIds: ['e1'], doneDates: [], projectId: 'p5' },
  { id: 'rm3', title: 'Salary run — foremen and site workers', date: `${today().slice(0, 7)}-28`, repeat: 'monthly', createdBy: 'e8', forIds: ['e8', 'e9', 'e1'], doneDates: [] },
  { id: 'rm4', title: 'Renew vehicle insurance — site pickup', date: addDays(today(), 12), repeat: 'yearly', createdBy: 'e1', forIds: [], doneDates: [] },
]
