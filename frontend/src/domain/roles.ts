import {
  MODULES, type Employee, type ModuleKey, type ModulePermission, type PermissionAction,
  type PermissionMatrix, type Role, type RoleKey,
} from './types'

/**
 * The ten login roles from the structure document. Internal employees only —
 * the client explicitly ruled out a separate client login.
 */
export const ROLES: Record<RoleKey, Role> = {
  super_admin: {
    key: 'super_admin',
    title: 'Super Admin',
    remit: 'Full system administration.',
  },
  ceo: {
    key: 'ceo',
    title: 'CEO / Founder / Operations Head',
    remit: 'Full operational visibility. Retains the lead responsibility: Lead → Generate → Close.',
  },
  design_director: {
    key: 'design_director',
    title: 'Design Director',
    remit: 'Design projects, scope, team, phases, approvals, progress, BOQ and design tasks.',
  },
  design_pm: {
    key: 'design_pm',
    title: 'Design Project Manager',
    remit: 'Assigned design projects, tasks, team allocation, deadlines, files, client feedback, phase completion.',
  },
  design_member: {
    key: 'design_member',
    title: 'Design Team Member',
    remit: 'Assigned projects and tasks, design uploads, task progress, comments, files and revisions.',
  },
  execution_head: {
    key: 'execution_head',
    title: 'Execution & Maintenance Head',
    remit: 'Execution projects, planning, phases, plant selection and layout, site teams, daily reports, maintenance and AMC.',
  },
  execution_pm: {
    key: 'execution_pm',
    title: 'Execution Project Manager',
    remit: 'Site and worker coordination, daily work monitoring, report review, issues and delays, next-day planning, attendance.',
  },
  foreman: {
    key: 'foreman',
    title: 'Execution Work Head / Foreman',
    remit: 'Site-level daily work reporting only. Does not see the wider CRM.',
  },
  accounts: {
    key: 'accounts',
    title: 'Accounts',
    remit: 'Quotations, payment requests, client payments and project financial summaries.',
  },
  marketing: {
    key: 'marketing',
    title: 'Marketing',
    remit: 'Leads and marketing.',
  },
}

/** The title to show for a person — their designation when set, otherwise the login role. */
export function titleOf(employee: Pick<Employee, 'role' | 'designation'>): string {
  return employee.designation?.trim() || ROLES[employee.role].title
}

// ---------------------------------------------------------------- navigation

export interface NavItem {
  label: string
  path: string
  /** A tab with a permission of its own, rather than its section's. */
  module?: ModuleKey
}

export interface NavSection {
  label: ModuleKey
  /** Where the sidebar link goes — the first tab for sections that have them. */
  path: string
  icon: string
  /** Shown as tabs across the top of the section, not in the sidebar. */
  children?: NavItem[]
}

/**
 * The navigation tree. The sidebar lists only these main sections; each
 * section's sub-pages appear as tabs inside it. Materials, Inventory,
 * Purchasing and Vendors were removed by the client and appear nowhere.
 */
export const NAV: NavSection[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'grid' },
  {
    // The CEO's consultation diary and the team's site visits, side by side.
    label: 'Consultations',
    path: '/consultations',
    icon: 'clock',
    children: [
      { label: 'Consultations', path: '/consultations' },
      { label: 'Site Visits', path: '/consultations/site-visits', module: 'Site Visits' },
    ],
  },
  {
    label: 'CRM',
    path: '/crm/leads',
    icon: 'users',
    children: [
      { label: 'Leads', path: '/crm/leads' },
      { label: 'Clients', path: '/crm/clients' },
    ],
  },
  {
    label: 'Projects',
    path: '/projects',
    icon: 'folder',
    children: [
      { label: 'All Projects', path: '/projects' },
      { label: 'Design Projects', path: '/projects/design' },
      { label: 'Execution Projects', path: '/projects/execution' },
      { label: 'AMC Projects', path: '/projects/amc' },
      { label: 'Map', path: '/projects/map' },
    ],
  },
  {
    label: 'Tasks',
    path: '/tasks/mine',
    icon: 'check',
    children: [
      { label: 'My Tasks', path: '/tasks/mine' },
      { label: 'Team Tasks', path: '/tasks/team' },
      { label: 'All Tasks', path: '/tasks/all' },
      { label: 'Task Board', path: '/tasks/board' },
    ],
  },
  {
    label: 'Design',
    path: '/design/concept',
    icon: 'pen',
    children: [
      { label: 'Concept', path: '/design/concept' },
      { label: '3D Presentation', path: '/design/3d' },
      { label: 'Civil Work', path: '/design/civil' },
      { label: 'BOQ', path: '/design/boq' },
    ],
  },
  {
    label: 'Execution',
    path: '/execution',
    icon: 'hammer',
    children: [
      { label: 'Projects', path: '/execution' },
      { label: 'Hardscape', path: '/execution/hardscape' },
      { label: 'Softscape', path: '/execution/softscape' },
      { label: 'MEP', path: '/execution/mep' },
      { label: 'Daily Work Reports', path: '/execution/reports' },
    ],
  },
  {
    // AMC is its own department, no longer a sub-page of Execution.
    label: 'AMC',
    path: '/amc',
    icon: 'leaf',
    children: [
      { label: 'Contracts', path: '/amc' },
      { label: 'AMC Calendar', path: '/amc/calendar' },
      { label: 'Visit Schedule', path: '/amc/visits' },
      { label: 'Renewals', path: '/amc/renewals' },
    ],
  },
  {
    label: 'Accounts',
    path: '/accounts/quotations',
    icon: 'rupee',
    children: [
      { label: 'BOQ & Quotations', path: '/accounts/quotations' },
      { label: 'Payment Requests', path: '/accounts/payment-requests' },
      { label: 'Payments', path: '/accounts/payments' },
    ],
  },
  {
    label: 'Employees',
    path: '/employees',
    icon: 'id',
    children: [
      { label: 'Employees', path: '/employees' },
      { label: 'Execution Workers', path: '/employees/workers' },
      { label: 'Attendance', path: '/employees/attendance', module: 'Attendance' },
      { label: 'Work Reports', path: '/employees/work-reports' },
    ],
  },
  { label: 'Gallery', path: '/gallery', icon: 'image' },
  { label: 'Documents', path: '/documents', icon: 'doc' },
  { label: 'Calendar', path: '/calendar', icon: 'calendar' },
  { label: 'Reports', path: '/reports', icon: 'chart' },
  { label: 'Settings', path: '/settings', icon: 'cog' },
]

/** Paths that sit inside a section without being one of its tabs. */
const EXTRA_PREFIXES: Partial<Record<ModuleKey, string[]>> = {
  CRM: ['/crm'],
  Projects: ['/projects'],
  Tasks: ['/tasks'],
  Design: ['/design'],
  Execution: ['/execution'],
  AMC: ['/amc'],
  Accounts: ['/accounts'],
  Employees: ['/employees'],
}

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/')

/** The section a URL belongs to, used for the sidebar highlight, the tab bar and the access check. */
export function sectionForPath(path: string): NavSection | undefined {
  return NAV.find((section) =>
    matches(path, section.path)
    || section.children?.some((c) => matches(path, c.path))
    || EXTRA_PREFIXES[section.label]?.some((p) => matches(path, p)),
  )
}

// ---------------------------------------------------------------- permissions

const ALL: ModulePermission = { view: true, create: true, edit: true, delete: true }
const NONE: ModulePermission = { view: false, create: false, edit: false, delete: false }

/**
 * Starting permissions, matching the remits in the structure document. The
 * CEO can change any of these from Settings → Roles & Permissions.
 *   view   — the section appears in the sidebar and opens
 *   manage — create and edit records in it
 *   remove — delete records in it
 */
const DEFAULTS: Record<Exclude<RoleKey, 'super_admin' | 'ceo' | 'foreman'>, {
  view: ModuleKey[]; manage: ModuleKey[]; remove: ModuleKey[]
}> = {
  design_director: {
    view: ['Dashboard', 'Consultations', 'Site Visits', 'CRM', 'Projects', 'Tasks', 'Design', 'Gallery', 'Documents', 'Calendar', 'Reports'],
    manage: ['Consultations', 'Site Visits', 'CRM', 'Projects', 'Tasks', 'Design', 'Documents'],
    remove: ['Site Visits', 'Tasks', 'Design', 'Documents'],
  },
  design_pm: {
    view: ['Dashboard', 'Consultations', 'Site Visits', 'Projects', 'Tasks', 'Design', 'Gallery', 'Documents', 'Calendar'],
    manage: ['Consultations', 'Site Visits', 'Tasks', 'Design', 'Documents'],
    remove: ['Tasks'],
  },
  design_member: {
    view: ['Dashboard', 'Consultations', 'Site Visits', 'Projects', 'Tasks', 'Design', 'Documents'],
    manage: ['Consultations', 'Tasks', 'Documents'],
    remove: [],
  },
  execution_head: {
    view: ['Dashboard', 'Consultations', 'Site Visits', 'Projects', 'Tasks', 'Execution', 'AMC', 'Employees', 'Attendance', 'Gallery', 'Documents', 'Calendar', 'Reports'],
    manage: ['Consultations', 'Site Visits', 'Projects', 'Tasks', 'Execution', 'AMC', 'Employees', 'Attendance', 'Documents'],
    remove: ['Site Visits', 'Tasks', 'Execution', 'AMC', 'Employees', 'Attendance'],
  },
  execution_pm: {
    // Attendance is part of the execution PM's remit, so they may mark and correct it.
    view: ['Dashboard', 'Consultations', 'Site Visits', 'Projects', 'Tasks', 'Execution', 'AMC', 'Employees', 'Attendance', 'Gallery', 'Documents', 'Calendar'],
    manage: ['Consultations', 'Site Visits', 'Tasks', 'Execution', 'AMC', 'Attendance', 'Documents'],
    remove: ['Tasks'],
  },
  accounts: {
    // Accounts read attendance for payroll but do not mark it.
    view: ['Dashboard', 'Consultations', 'Site Visits', 'CRM', 'Projects', 'Accounts', 'Attendance', 'Documents', 'Reports'],
    manage: ['Consultations', 'CRM', 'Accounts', 'Documents'],
    remove: ['Accounts'],
  },
  marketing: {
    view: ['Dashboard', 'Consultations', 'Site Visits', 'CRM', 'Calendar'],
    manage: ['Consultations', 'Site Visits', 'CRM'],
    remove: ['Site Visits', 'CRM'],
  },
}

/** Modules that were renamed, so permissions saved under the old name carry over. */
const RENAMED_MODULES: Record<string, ModuleKey> = { 'CEO Consultations': 'Consultations' }

/**
 * Brings a permission matrix saved by an older version up to date: renamed
 * modules keep their ticks, and modules added since start from the defaults.
 */
export function normalizePermissions(stored?: Partial<Record<RoleKey, Partial<Record<string, ModulePermission>>>>): PermissionMatrix {
  const defaults = defaultPermissions()
  if (!stored) return defaults
  const out = {} as PermissionMatrix
  for (const role of Object.keys(defaults) as RoleKey[]) {
    const rows: Partial<Record<string, ModulePermission>> = { ...stored[role] }
    for (const [from, to] of Object.entries(RENAMED_MODULES)) {
      if (rows[from] && !rows[to]) rows[to] = rows[from]
    }
    out[role] = Object.fromEntries(MODULES.map((m) => [m, rows[m] ?? defaults[role][m]])) as Record<ModuleKey, ModulePermission>
  }
  return out
}

export function defaultPermissions(): PermissionMatrix {
  const build = (fn: (m: ModuleKey) => ModulePermission) =>
    Object.fromEntries(MODULES.map((m) => [m, fn(m)])) as Record<ModuleKey, ModulePermission>

  const matrix = {} as PermissionMatrix
  matrix.super_admin = build(() => ({ ...ALL }))
  matrix.ceo = build(() => ({ ...ALL }))
  // Foremen only ever see the field app, so they hold no module access.
  matrix.foreman = build(() => ({ ...NONE }))
  for (const [role, d] of Object.entries(DEFAULTS) as [keyof typeof DEFAULTS, (typeof DEFAULTS)[keyof typeof DEFAULTS]][]) {
    matrix[role] = build((m) => ({
      view: d.view.includes(m),
      create: d.manage.includes(m),
      edit: d.manage.includes(m),
      delete: d.remove.includes(m),
    }))
  }
  return matrix
}

/**
 * Roles whose access is fixed: the super admin always holds everything, and
 * foremen are confined to the field app.
 */
export const LOCKED_ROLES: RoleKey[] = ['super_admin', 'foreman']

export function hasPermission(
  matrix: PermissionMatrix | undefined, role: RoleKey, module: ModuleKey, action: PermissionAction,
): boolean {
  if (role === 'super_admin') return true
  if (role === 'foreman') return false
  const entry = (matrix ?? defaultPermissions())[role]?.[module]
  if (!entry) return false
  // Any action implies being able to see the module.
  return action === 'view' ? entry.view : entry.view && entry[action]
}

/** The permission a page answers to: its tab's own module when it has one, otherwise its section's. */
export function moduleOf(section: NavSection, tab?: NavItem): ModuleKey {
  return tab?.module ?? section.label
}

/**
 * The sidebar for a role. A section shows when any of its tabs may be viewed;
 * it keeps only those tabs, and its link opens the first of them.
 */
export function navForRole(role: RoleKey, matrix?: PermissionMatrix): NavSection[] {
  if (role === 'foreman') return []
  return NAV.flatMap((section) => {
    if (!section.children) return hasPermission(matrix, role, section.label, 'view') ? [section] : []
    const children = section.children.filter((tab) => hasPermission(matrix, role, moduleOf(section, tab), 'view'))
    return children.length ? [{ ...section, path: children[0].path, children }] : []
  })
}

/** Capability checks used where a role gates an action rather than a screen. */
export const can = {
  reviewReports: (role: RoleKey) =>
    ['super_admin', 'ceo', 'execution_head', 'execution_pm'].includes(role),
  adjustOt: (role: RoleKey) =>
    ['super_admin', 'ceo', 'execution_head', 'execution_pm'].includes(role),
  /** Everyone can book; only the CEO's office can mark a consultation done or cancel others' bookings. */
  manageConsultations: (role: RoleKey) => ['super_admin', 'ceo'].includes(role),
  manageAmc: (role: RoleKey) => ['super_admin', 'ceo', 'execution_head', 'execution_pm'].includes(role),
}
