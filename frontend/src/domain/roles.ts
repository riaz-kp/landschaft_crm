import type { Role, RoleKey } from './types'

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

// ---------------------------------------------------------------- navigation

export interface NavItem {
  label: string
  path: string
}

export interface NavSection {
  label: string
  /** Sections without children navigate directly. */
  path?: string
  icon: string
  children?: NavItem[]
}

/**
 * The full navigation tree, exactly as specified. Materials, Inventory,
 * Purchasing and Vendors were removed by the client and appear nowhere.
 */
export const NAV: NavSection[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'grid' },
  {
    label: 'CRM',
    icon: 'users',
    children: [
      { label: 'Leads', path: '/crm/leads' },
      { label: 'Clients', path: '/crm/clients' },
      { label: 'Site Visits', path: '/crm/site-visits' },
    ],
  },
  {
    label: 'Projects',
    icon: 'folder',
    children: [
      { label: 'All Projects', path: '/projects' },
      { label: 'Design Projects', path: '/projects/design' },
      { label: 'Execution Projects', path: '/projects/execution' },
    ],
  },
  {
    label: 'Tasks',
    icon: 'check',
    children: [
      { label: 'My Tasks', path: '/tasks/mine' },
      { label: 'Team Tasks', path: '/tasks/team' },
      { label: 'Task Board', path: '/tasks/board' },
    ],
  },
  {
    label: 'Design',
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
    icon: 'hammer',
    children: [
      { label: 'Projects', path: '/execution' },
      { label: 'Hardscape', path: '/execution/hardscape' },
      { label: 'Softscape', path: '/execution/softscape' },
      { label: 'MEP', path: '/execution/mep' },
      { label: 'Daily Work Reports', path: '/execution/reports' },
      { label: 'Maintenance', path: '/execution/maintenance' },
    ],
  },
  {
    label: 'Accounts',
    icon: 'rupee',
    children: [
      { label: 'Quotations', path: '/accounts/quotations' },
      { label: 'Payment Requests', path: '/accounts/payment-requests' },
      { label: 'Payments', path: '/accounts/payments' },
    ],
  },
  {
    label: 'Employees',
    icon: 'id',
    children: [
      { label: 'Employees', path: '/employees' },
      { label: 'Execution Workers', path: '/employees/workers' },
      { label: 'Attendance', path: '/employees/attendance' },
      { label: 'Work Reports', path: '/employees/work-reports' },
    ],
  },
  { label: 'Documents', path: '/documents', icon: 'doc' },
  { label: 'Calendar', path: '/calendar', icon: 'calendar' },
  { label: 'Reports', path: '/reports', icon: 'chart' },
  { label: 'Settings', path: '/settings', icon: 'cog' },
]

// ---------------------------------------------------------------- permissions

/**
 * Top-level sections each role may open. Foremen are absent entirely — they
 * are redirected to the field app and never reach this shell.
 */
const SECTION_ACCESS: Record<RoleKey, string[] | '*'> = {
  super_admin: '*',
  ceo: '*',
  design_director: ['Dashboard', 'CRM', 'Projects', 'Tasks', 'Design', 'Documents', 'Calendar', 'Reports'],
  design_pm: ['Dashboard', 'Projects', 'Tasks', 'Design', 'Documents', 'Calendar'],
  design_member: ['Dashboard', 'Projects', 'Tasks', 'Design', 'Documents'],
  execution_head: [
    'Dashboard', 'Projects', 'Tasks', 'Execution', 'Employees', 'Documents', 'Calendar', 'Reports',
  ],
  execution_pm: ['Dashboard', 'Projects', 'Tasks', 'Execution', 'Employees', 'Documents', 'Calendar'],
  foreman: [],
  accounts: ['Dashboard', 'CRM', 'Projects', 'Accounts', 'Documents', 'Reports'],
  marketing: ['Dashboard', 'CRM', 'Calendar'],
}

export function navForRole(role: RoleKey): NavSection[] {
  const allowed = SECTION_ACCESS[role]
  if (allowed === '*') return NAV
  return NAV.filter((section) => allowed.includes(section.label))
}

export function canAccessPath(role: RoleKey, path: string): boolean {
  const sections = navForRole(role)
  return sections.some((section) => {
    if (section.path && path.startsWith(section.path)) return true
    return section.children?.some((child) => path === child.path || path.startsWith(child.path + '/'))
  })
}

/** Capability checks used where a role gates an action rather than a screen. */
export const can = {
  reviewReports: (role: RoleKey) =>
    ['super_admin', 'ceo', 'execution_head', 'execution_pm'].includes(role),
  adjustOt: (role: RoleKey) =>
    ['super_admin', 'ceo', 'execution_head', 'execution_pm'].includes(role),
  createProject: (role: RoleKey) =>
    ['super_admin', 'ceo', 'design_director', 'execution_head'].includes(role),
  editSettings: (role: RoleKey) => ['super_admin', 'ceo'].includes(role),
  manageEmployees: (role: RoleKey) => ['super_admin', 'ceo', 'execution_head'].includes(role),
}
