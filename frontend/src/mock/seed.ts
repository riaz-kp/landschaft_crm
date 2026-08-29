import { addDays, today } from '../domain/format'
import type {
  CalendarEvent, Client, DailyWorkReport, DocumentRecord, Employee, Issue, Lead,
  MaintenanceRecord, Payment, PaymentRequest, Phase, Project, Quotation, Settings,
  SiteAssignment, SiteVisit, Task, Worker,
} from '../domain/types'

const phase = (enabled: boolean, progress = 0): Phase => ({ enabled, progress })

/** The organisational structure supplied by the client, reproduced verbatim. */
export const employees: Employee[] = [
  { id: 'e0', name: 'System Administrator', role: 'super_admin', department: 'Management', phone: '+91 90000 00000', email: 'admin@landschaft.in' },
  { id: 'e1', name: 'Ashfaq', role: 'ceo', department: 'Management', phone: '+91 98470 11001', email: 'ashfaq@landschaft.in' },
  { id: 'e2', name: 'Anees', role: 'design_director', department: 'Design', reportsTo: 'e1', phone: '+91 98470 11002', email: 'anees@landschaft.in' },
  { id: 'e3', name: 'Sai Krishna', role: 'design_pm', department: 'Design', reportsTo: 'e2', phone: '+91 98470 11003', email: 'saikrishna@landschaft.in' },
  { id: 'e4', name: 'Mustafa', role: 'design_member', department: 'Design', reportsTo: 'e3', phone: '+91 98470 11004', email: 'mustafa@landschaft.in' },
  { id: 'e5', name: 'Nihal', role: 'design_member', department: 'Design', reportsTo: 'e3', phone: '+91 98470 11005', email: 'nihal@landschaft.in' },
  { id: 'e6', name: 'Thameem', role: 'execution_head', department: 'Execution', reportsTo: 'e1', phone: '+91 98470 11006', email: 'thameem@landschaft.in' },
  { id: 'e7', name: 'Jidhin', role: 'execution_pm', department: 'Execution', reportsTo: 'e6', phone: '+91 98470 11007', email: 'jidhin@landschaft.in' },
  { id: 'e8', name: 'Arshad', role: 'accounts', department: 'Accounts', reportsTo: 'e1', phone: '+91 98470 11008', email: 'arshad@landschaft.in' },
  { id: 'e9', name: 'Anaswara', role: 'accounts', department: 'Accounts', reportsTo: 'e8', phone: '+91 98470 11009', email: 'anaswara@landschaft.in' },
  { id: 'e10', name: 'Swalih', role: 'marketing', department: 'Marketing', reportsTo: 'e1', phone: '+91 98470 11010', email: 'swalih@landschaft.in' },
  // Site work heads / foremen — each gets their own login.
  { id: 'e11', name: 'Ashiq', role: 'foreman', department: 'Execution', reportsTo: 'e7', phone: '+91 98470 11011', email: 'ashiq@landschaft.in' },
  { id: 'e12', name: 'Niyas', role: 'foreman', department: 'Execution', reportsTo: 'e7', phone: '+91 98470 11012', email: 'niyas@landschaft.in' },
  { id: 'e13', name: 'Shihab', role: 'foreman', department: 'Execution', reportsTo: 'e7', phone: '+91 98470 11013', email: 'shihab@landschaft.in' },
]

/** Site labour. Workers are recorded by foremen and do not log in. */
export const workers: Worker[] = [
  { id: 'w1', name: 'Ashiq', skill: 'Foreman / Planting', phone: '+91 97450 20001', active: true },
  { id: 'w2', name: 'Niyas', skill: 'Foreman / Hardscape', phone: '+91 97450 20002', active: true },
  { id: 'w3', name: 'Shihab', skill: 'Foreman / Lawn', phone: '+91 97450 20003', active: true },
  { id: 'w4', name: 'Junaid', skill: 'Mason', phone: '+91 97450 20004', active: true },
  { id: 'w5', name: 'Rafeeq', skill: 'Mason', phone: '+91 97450 20005', active: true },
  { id: 'w6', name: 'Sabu', skill: 'Gardener', phone: '+91 97450 20006', active: true },
  { id: 'w7', name: 'Manoj', skill: 'Gardener', phone: '+91 97450 20007', active: true },
  { id: 'w8', name: 'Vinod', skill: 'Helper', phone: '+91 97450 20008', active: true },
  { id: 'w9', name: 'Salim', skill: 'Plumber / Irrigation', phone: '+91 97450 20009', active: true },
  { id: 'w10', name: 'Faisal', skill: 'Electrician', phone: '+91 97450 20010', active: true },
  { id: 'w11', name: 'Anand', skill: 'Helper', phone: '+91 97450 20011', active: true },
  { id: 'w12', name: 'Basheer', skill: 'Driver / Helper', phone: '+91 97450 20012', active: false },
]

export const clients: Client[] = [
  { id: 'c1', name: 'ABC Holdings', phone: '+91 94470 30001', email: 'contact@abcholdings.in', address: 'Kowdiar, Thiruvananthapuram', leadId: 'l1', createdAt: '2026-04-12' },
  { id: 'c2', name: 'XYZ Estates', phone: '+91 94470 30002', email: 'projects@xyzestates.in', address: 'Panampilly Nagar, Kochi', leadId: 'l2', createdAt: '2026-05-02' },
  { id: 'c3', name: 'DEF Resorts', phone: '+91 94470 30003', email: 'gm@defresorts.in', address: 'Kovalam, Thiruvananthapuram', leadId: 'l3', createdAt: '2026-05-20' },
  { id: 'c4', name: 'Dr. Ramesh Nair', phone: '+91 94470 30004', email: 'ramesh.nair@gmail.com', address: 'Edava, Varkala', createdAt: '2026-06-08' },
  { id: 'c5', name: 'Greenfield Apartments', phone: '+91 94470 30005', email: 'assoc@greenfield.in', address: 'Kozhikode', createdAt: '2026-06-25' },
]

export const leads: Lead[] = [
  { id: 'l1', name: 'ABC Holdings', phone: '+91 94470 30001', email: 'contact@abcholdings.in', location: 'Thiruvananthapuram', source: 'Referral', status: 'Won', ownerId: 'e10', requirement: 'Residence landscape design for a new villa', createdAt: '2026-03-28', clientId: 'c1' },
  { id: 'l2', name: 'XYZ Estates', phone: '+91 94470 30002', location: 'Kochi', source: 'Website', status: 'Won', ownerId: 'e10', requirement: 'Villa landscape execution, design already done in-house', createdAt: '2026-04-18', clientId: 'c2' },
  { id: 'l3', name: 'DEF Resorts', phone: '+91 94470 30003', location: 'Kovalam', source: 'Exhibition', status: 'Won', ownerId: 'e1', requirement: 'Full resort landscape — design and execution', createdAt: '2026-05-05', clientId: 'c3' },
  { id: 'l4', name: 'Suresh Menon', phone: '+91 94470 30006', location: 'Kollam', source: 'Instagram', status: 'Quoted', ownerId: 'e10', requirement: 'Terrace garden, approx 1200 sq ft', createdAt: '2026-08-02' },
  { id: 'l5', name: 'Lakeview Villas', phone: '+91 94470 30007', email: 'info@lakeview.in', location: 'Alappuzha', source: 'Google', status: 'Site Visit', ownerId: 'e10', requirement: 'Common area landscaping for 18 villas', createdAt: '2026-08-11' },
  { id: 'l6', name: 'Fathima Beevi', phone: '+91 94470 30008', location: 'Malappuram', source: 'Referral', status: 'Contacted', ownerId: 'e10', requirement: 'Front yard redesign with water feature', createdAt: '2026-08-19' },
  { id: 'l7', name: 'Cyber Park Facility', phone: '+91 94470 30009', email: 'facility@cyberpark.in', location: 'Kozhikode', source: 'Website', status: 'New', ownerId: 'e10', requirement: 'Campus softscape AMC enquiry', createdAt: '2026-08-26' },
  { id: 'l8', name: 'Hotel Sea Pearl', phone: '+91 94470 30010', location: 'Varkala', source: 'Walk-in', status: 'Lost', ownerId: 'e10', requirement: 'Poolside landscaping — went with another vendor', createdAt: '2026-07-14' },
]

export const siteVisits: SiteVisit[] = [
  { id: 'sv1', leadId: 'l5', location: 'Alappuzha', date: addDays(today(), 2), assignedTo: 'e2', status: 'Scheduled', notes: 'Measure common areas and check soil drainage.' },
  { id: 'sv2', leadId: 'l6', location: 'Malappuram', date: addDays(today(), 4), assignedTo: 'e3', status: 'Scheduled', notes: 'Client wants a water feature — check water supply.' },
  { id: 'sv3', leadId: 'l4', location: 'Kollam', date: addDays(today(), -6), assignedTo: 'e2', status: 'Completed', notes: 'Terrace load-bearing confirmed adequate. Quote sent.' },
  { id: 'sv4', clientId: 'c5', location: 'Kozhikode', date: addDays(today(), -2), assignedTo: 'e6', status: 'Completed', notes: 'Hardscape area marked out with the association secretary.' },
  { id: 'sv5', leadId: 'l8', location: 'Varkala', date: addDays(today(), -20), assignedTo: 'e2', status: 'Cancelled', notes: 'Client postponed, later lost.' },
]

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
  },
  {
    id: 'p6', code: 'LS-2026-006', name: 'Kovalam Villa Concept', clientId: 'c3',
    siteLocation: 'Kovalam', projectManagerId: 'e3',
    startDate: '2026-08-01', expectedCompletion: '2026-10-20', status: 'Planning',
    services: { design: true, execution: false },
    design: { concept: phase(true, 40), threeD: phase(true, 0), civilWork: phase(false), boq: phase(true, 0) },
    execution: { hardscape: phase(false), softscape: phase(false), mep: { enabled: false, progress: 0, services: { irrigation: false, electrical: false, drainage: false } }, maintenance: phase(false) },
    value: 420000, delayed: false,
  },
  {
    id: 'p7', code: 'LS-2025-018', name: 'Sea Breeze Villa', clientId: 'c2',
    siteLocation: 'Fort Kochi', projectManagerId: 'e7',
    startDate: '2025-11-01', expectedCompletion: '2026-06-30', status: 'Completed',
    services: { design: true, execution: true },
    design: { concept: phase(true, 100), threeD: phase(true, 100), civilWork: phase(true, 100), boq: phase(true, 100) },
    execution: {
      hardscape: phase(true, 100), softscape: phase(true, 100), mep: { enabled: true, progress: 100, services: { irrigation: true, electrical: true, drainage: true } },
      maintenance: phase(true, 40),
    },
    value: 5400000, delayed: false,
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

/**
 * Today's site reports, matching the document's example table:
 * Edava / Ashiq / 1 / Planting / Submitted
 * Kozhikode / Niyas / 6 / Hardscape / Approved
 * Kochi / Shihab / 4 / Lawn work / Pending
 */
export const reports: DailyWorkReport[] = [
  {
    id: 'r1', projectId: 'p4', siteLocation: 'എടവ', date: today(), foremanId: 'e11',
    attendance: present(['w1'], ['w1', 'w4', 'w6', 'w8', 'w11']),
    startTime: '10:00', endTime: '15:40', otHours: 0,
    workDone: ['Soil preparation completed', '25 plants planted', 'Lawn area levelled'],
    issues: ['Nothing'],
    nextDayPlan: ['Continue planting in the rear garden', 'Begin drip line layout'],
    ta: [{ workerId: 'w1', distanceKm: 12 }],
    photos: [], status: 'Submitted', submittedAt: '16:15', submittedBy: 'e11',
  },
  {
    id: 'r2', projectId: 'p5', siteLocation: 'Kozhikode', date: today(), foremanId: 'e12',
    attendance: present(['w2', 'w4', 'w5', 'w8', 'w11', 'w7'], ['w2', 'w4', 'w5', 'w8', 'w11', 'w7', 'w6'], '09:00', '17:00'),
    startTime: '09:00', endTime: '17:00', otHours: 1,
    workDone: ['Walkway kerb casting — 40 running metres', 'Paver base compaction at block B'],
    issues: ['Nothing'],
    nextDayPlan: ['Continue kerb casting', 'Paver laying at block B'],
    ta: [{ workerId: 'w2', distanceKm: 8 }, { workerId: 'w4', distanceKm: 15 }],
    photos: [], status: 'Approved', submittedAt: '17:20', submittedBy: 'e12',
    reviewedAt: '18:05', reviewedBy: 'e7', reviewNote: 'Good progress. Keep the kerb line true to the drawing.',
  },
  {
    id: 'r3', projectId: 'p8', siteLocation: 'Kochi', date: today(), foremanId: 'e13',
    attendance: present(['w3', 'w6', 'w7', 'w8'], ['w3', 'w6', 'w7', 'w8', 'w11'], '09:30', '16:30'),
    startTime: '09:30', endTime: '16:30', otHours: 0,
    workDone: ['Lawn work — levelling and grading at the front lawn'],
    issues: [],
    nextDayPlan: ['Lay lawn turf if the material arrives'],
    ta: [{ workerId: 'w3', distanceKm: 20 }],
    photos: [], status: 'Draft',
  },
  {
    id: 'r4', projectId: 'p4', siteLocation: 'എടവ', date: addDays(today(), -1), foremanId: 'e11',
    attendance: present(['w1', 'w6', 'w8'], ['w1', 'w4', 'w6', 'w8', 'w11']),
    startTime: '10:00', endTime: '16:00', otHours: 0,
    workDone: ['Marked out planting beds', 'Removed construction debris'],
    issues: ['Water connection at the site was cut off for two hours'],
    nextDayPlan: ['Soil preparation', 'Start planting'],
    ta: [{ workerId: 'w1', distanceKm: 12 }],
    photos: [], status: 'Approved', submittedAt: '16:30', submittedBy: 'e11',
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
    photos: [], status: 'Approved', submittedAt: '18:00', submittedBy: 'e12',
    reviewedAt: '19:00', reviewedBy: 'e7',
  },
{
    id: 'r6', projectId: 'p3', siteLocation: 'Kovalam', date: today(), foremanId: 'e12',
    attendance: present(['w2', 'w5', 'w9', 'w10', 'w11', 'w4', 'w8'], ['w2', 'w5', 'w9', 'w10', 'w11', 'w4', 'w8'], '08:30', '17:30'),
    startTime: '08:30', endTime: '17:30', otHours: 1,
    workDone: ['Pool deck paving completed', 'Irrigation trunk line laid to zone 3'],
    issues: ['Nothing'],
    nextDayPlan: ['Begin planting to the entrance beds', 'Pressure-test irrigation zone 3'],
    ta: [{ workerId: 'w2', distanceKm: 25 }, { workerId: 'w5', distanceKm: 25 }],
    photos: [], status: 'Approved', submittedAt: '17:55', submittedBy: 'e12',
    reviewedAt: '18:40', reviewedBy: 'e7',
  },
  {
    id: 'r7', projectId: 'p2', siteLocation: 'Panampilly Nagar, Kochi', date: today(), foremanId: 'e13',
    attendance: present(['w3', 'w6', 'w7', 'w8', 'w11'], ['w3', 'w6', 'w7', 'w8', 'w11'], '09:00', '16:30'),
    startTime: '09:00', endTime: '16:30', otHours: 0,
    workDone: ['Softscape bed preparation at the rear garden', 'Palm pit excavation'],
    issues: ['Nothing'],
    nextDayPlan: ['Set out palms per the planting drawing'],
    ta: [{ workerId: 'w3', distanceKm: 18 }],
    photos: [], status: 'Submitted', submittedAt: '16:50', submittedBy: 'e13',
  },
]

export const issues: Issue[] = [
  { id: 'i1', projectId: 'p4', reportId: 'r4', text: 'Water connection at the site was cut off for two hours', raisedBy: 'e11', assignedTo: 'e7', date: addDays(today(), -1), status: 'Resolved' },
  { id: 'i2', projectId: 'p3', reportId: 'r5', text: 'Paver delivery short by 200 units, supplier notified', raisedBy: 'e12', assignedTo: 'e7', date: addDays(today(), -1), status: 'Open' },
  { id: 'i3', projectId: 'p5', reportId: 'r2', text: 'Association requested a change to the walkway alignment', raisedBy: 'e12', assignedTo: 'e7', date: addDays(today(), -2), status: 'Open' },
]

export const quotations: Quotation[] = [
  { id: 'q1', number: 'QT-2026-011', projectId: 'p1', clientId: 'c1', date: '2026-04-20', status: 'Accepted', items: [{ description: 'Concept design', quantity: 1, unit: 'LS', rate: 425000 }, { description: '3D presentation', quantity: 1, unit: 'LS', rate: 170000 }, { description: 'Civil drawings', quantity: 1, unit: 'LS', rate: 127500 }, { description: 'BOQ preparation', quantity: 1, unit: 'LS', rate: 127500 }] },
  { id: 'q2', number: 'QT-2026-014', projectId: 'p2', clientId: 'c2', date: '2026-05-18', status: 'Accepted', items: [{ description: 'Hardscape works', quantity: 1, unit: 'LS', rate: 1200000 }, { description: 'Softscape works', quantity: 1, unit: 'LS', rate: 850000 }, { description: 'Irrigation and electrical', quantity: 1, unit: 'LS', rate: 350000 }] },
  { id: 'q3', number: 'QT-2026-021', projectId: 'p6', clientId: 'c3', date: '2026-07-28', status: 'Sent', items: [{ description: 'Concept design', quantity: 1, unit: 'LS', rate: 210000 }, { description: '3D presentation', quantity: 1, unit: 'LS', rate: 105000 }, { description: 'BOQ preparation', quantity: 1, unit: 'LS', rate: 105000 }] },
  { id: 'q4', number: 'QT-2026-023', projectId: 'p8', clientId: 'c5', date: '2026-08-05', status: 'Draft', items: [{ description: 'Campus softscape', quantity: 1, unit: 'LS', rate: 1450000 }, { description: 'Irrigation and drainage', quantity: 1, unit: 'LS', rate: 450000 }] },
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

export const maintenance: MaintenanceRecord[] = [
  {
    id: 'm1', projectId: 'p7', type: 'Free Maintenance', startDate: '2026-07-01', endDate: '2026-07-31',
    teamIds: ['w6', 'w7'], scopeOfWork: 'Weekly plant care, lawn mowing, irrigation checks and snag rectification.',
    visitSchedule: 'Weekly — every Tuesday',
    visits: [
      { id: 'mv1', date: '2026-07-07', teamIds: ['w6', 'w7'], notes: 'Lawn mowing and first fertiliser round.', issues: [], photoCount: 4, done: true },
      { id: 'mv2', date: '2026-07-14', teamIds: ['w6'], notes: 'Pruning and irrigation nozzle check.', issues: ['Two drip emitters blocked, replaced.'], photoCount: 3, done: true },
      { id: 'mv3', date: '2026-07-21', teamIds: ['w6', 'w7'], notes: 'Lawn mowing, weed removal.', issues: [], photoCount: 5, done: true },
      { id: 'mv4', date: '2026-07-28', teamIds: ['w6'], notes: 'Final free-maintenance visit and handover walkthrough.', issues: [], photoCount: 6, done: true },
    ],
  },
  {
    id: 'm2', projectId: 'p7', type: 'AMC', startDate: '2026-08-01', endDate: '2027-07-31',
    teamIds: ['w6', 'w7'], scopeOfWork: 'Monthly plant health care, lawn maintenance, irrigation servicing, seasonal replanting and pest control.',
    visitSchedule: 'Fortnightly — 1st and 3rd Tuesday', renewalDate: '2027-07-31', value: 240000,
    visits: [
      { id: 'mv5', date: '2026-08-04', teamIds: ['w6', 'w7'], notes: 'First AMC visit — full site inspection.', issues: [], photoCount: 8, done: true },
      { id: 'mv6', date: '2026-08-18', teamIds: ['w6'], notes: 'Lawn mowing and pest control application.', issues: ['Fungal spotting on two shrubs — treated.'], photoCount: 4, done: true },
      { id: 'mv7', date: addDays(today(), 5), teamIds: ['w6', 'w7'], notes: '', issues: [], photoCount: 0, done: false },
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
  { id: 'd8', name: 'Sea Breeze — AMC Agreement.pdf', projectId: 'p7', category: 'Contract', uploadedBy: 'e8', uploadedAt: addDays(today(), -29), sizeKb: 960 },
]

export const calendarEvents: CalendarEvent[] = [
  { id: 'ce1', title: 'Site visit — Lakeview Villas', date: addDays(today(), 2), type: 'Site Visit', assigneeId: 'e2' },
  { id: 'ce2', title: 'Site visit — Fathima Beevi', date: addDays(today(), 4), type: 'Site Visit', assigneeId: 'e3' },
  { id: 'ce3', title: '3D presentation due — ABC Residence', date: addDays(today(), 3), type: 'Deadline', projectId: 'p1', assigneeId: 'e4' },
  { id: 'ce4', title: 'AMC visit — Sea Breeze Villa', date: addDays(today(), 5), type: 'Maintenance', projectId: 'p7', assigneeId: 'e6' },
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
  otAdjustRoles: ['super_admin', 'ceo', 'execution_head', 'execution_pm'],
  freeMaintenanceMonths: 1,
}

/** Counters shown on the execution dashboard, per the document's example. */
export const executionDashboardSeed = {
  activeSites: 8,
  totalSitesReporting: 8,
  workersToday: 34,
  completedTasks: 27,
}
