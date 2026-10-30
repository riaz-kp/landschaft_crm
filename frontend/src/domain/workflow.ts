import { formatCurrency } from './format'
import { DESIGN_PHASES, PHASE_LABELS } from './types'
import type { Employee, Project, RoleKey, Settings, WorkflowStepKey } from './types'

/**
 * One hand-off on the way from an enquiry to work starting on site. Ticking a
 * step tells the people who act next, through a reminder on their bell.
 */
export interface WorkflowStep {
  key: WorkflowStepKey
  stage: 'Design' | 'Execution'
  label: string
  /** Roles whose job the step is. The CEO and Super Admin can tick any step. */
  owners: RoleKey[]
  /** Roles told once it is ticked, and what they are asked to do. */
  notify: RoleKey[]
  notice: (project: Project, settings: Settings) => string
  applies: (project: Project) => boolean
}

const DESIGN_ROLES: RoleKey[] = ['design_director', 'design_pm', 'design_member']
const EXECUTION_ROLES: RoleKey[] = ['execution_head', 'execution_pm']
const designed = (p: Project) => p.services.design
const executed = (p: Project) => p.services.execution

/** "₹1,20,000 (30%)" when the value is known, else just "30%". */
function share(value: number | undefined, percent: number): string {
  return value ? `${formatCurrency((value * percent) / 100)} (${percent}%)` : `${percent}%`
}

export const WORKFLOW: WorkflowStep[] = [
  {
    key: 'siteVisit', stage: 'Design', label: 'Site visited before the proposal',
    owners: ['ceo', ...DESIGN_ROLES], notify: ['design_director'],
    notice: () => 'Site visited — the scope proposal can be prepared',
    applies: (p) => designed(p) && Boolean(p.siteVisitRequired),
  },
  {
    key: 'scopePrepared', stage: 'Design', label: 'Scope prepared by the design wing and shared with the CEO',
    owners: DESIGN_ROLES, notify: ['ceo'],
    notice: () => 'Scope proposal ready — review it and share it with the client',
    applies: designed,
  },
  {
    key: 'scopeToClient', stage: 'Design', label: 'Scope shared with the client',
    owners: ['ceo'], notify: [],
    notice: () => '',
    applies: designed,
  },
  {
    key: 'clientApproved', stage: 'Design', label: 'Client approved the scope',
    owners: ['ceo'], notify: ['ceo'],
    notice: () => 'Client approved the scope — plan the site visit',
    applies: designed,
  },
  {
    key: 'scopeConfirmed', stage: 'Design', label: 'Scope confirmed',
    owners: ['ceo', 'design_director'], notify: ['accounts', 'design_pm'],
    notice: (p, s) => `Scope confirmed — collect the design advance, ${share(p.designValue, s.designPaymentSplit.concept)}`,
    applies: designed,
  },
  {
    key: 'teamAllocated', stage: 'Design', label: 'Work allocated among the design team',
    owners: ['design_pm', 'design_director'], notify: ['design_member'],
    notice: () => 'Design work allocated — check your tasks on this project',
    applies: designed,
  },
  {
    key: 'conceptDone', stage: 'Design', label: 'Concept finished',
    owners: DESIGN_ROLES, notify: ['accounts'],
    notice: (p, s) => `Concept finished — collect the 3D payment, ${share(p.designValue, s.designPaymentSplit.threeD)}`,
    applies: designed,
  },
  {
    key: 'civilDone', stage: 'Design', label: 'Civil work drawings completed',
    owners: DESIGN_ROLES, notify: ['execution_head', 'execution_pm', 'ceo'],
    notice: () => 'Civil work drawings completed — prepare the execution quotation for the client',
    applies: designed,
  },
  {
    key: 'quotationSent', stage: 'Execution', label: 'Execution quotation sent to the client',
    owners: EXECUTION_ROLES, notify: ['ceo'],
    notice: () => 'Execution quotation sent to the client',
    applies: executed,
  },
  {
    key: 'workStarted', stage: 'Execution', label: 'Work started on site',
    owners: EXECUTION_ROLES, notify: ['accounts'],
    notice: (p, s) => {
      const first = s.executionPaymentSlabs[0]
      return first ? `Work started — collect ${first.label.toLowerCase()} payment, ${share(p.executionValue, first.percent)}` : 'Work started on site'
    },
    applies: executed,
  },
]

export const stepFor = (key: WorkflowStepKey) => WORKFLOW.find((s) => s.key === key)!

/** The steps that apply to this project, in order. */
export function workflowFor(project: Project): WorkflowStep[] {
  return WORKFLOW.filter((s) => s.applies(project))
}

/** The first step not yet ticked, or undefined once all are done. */
export function nextStep(project: Project): WorkflowStep | undefined {
  return workflowFor(project).find((s) => !project.workflow?.[s.key]?.done)
}

export function canTickStep(step: WorkflowStep, role: RoleKey): boolean {
  return role === 'super_admin' || role === 'ceo' || step.owners.includes(role)
}

/** Everyone holding one of the roles, by name — "Ashfaq", "Jidhin, Rohith". */
export function holders(employees: Employee[], roles: RoleKey[]): Employee[] {
  return employees.filter((e) => roles.includes(e.role))
}

export interface ScheduleRow {
  stage: 'Design' | 'Execution'
  label: string
  /** The point it is collected at, e.g. "Scope confirmed". */
  dueWhen: string
  percent: number
  amount?: number
  /** Whether that point has been reached; undefined where the system cannot tell. */
  reached?: boolean
}

/**
 * What the client pays and when: the design value split by phase and the
 * execution value by slab, both from Settings. Each design phase is paid for
 * up front — the concept as the advance once the scope is confirmed, the 3D
 * once the concept is finished, and so on. The first execution slab falls due
 * when work starts and the last at completion.
 */
export function paymentSchedule(project: Project, settings: Settings): ScheduleRow[] {
  const rows: ScheduleRow[] = []
  const wf = project.workflow ?? {}
  const finished = (key: (typeof DESIGN_PHASES)[number]) => project.design[key].enabled && project.design[key].progress >= 100
  if (project.services.design) {
    const due: Record<(typeof DESIGN_PHASES)[number], [string, boolean]> = {
      concept: ['Scope confirmed — advance', Boolean(wf.scopeConfirmed?.done)],
      threeD: ['Concept finished', Boolean(wf.conceptDone?.done) || finished('concept')],
      civilWork: ['3D presentation finished', finished('threeD')],
      boq: ['Civil work drawings completed', Boolean(wf.civilDone?.done) || finished('civilWork')],
    }
    for (const key of DESIGN_PHASES) {
      if (!project.design[key].enabled) continue
      const percent = settings.designPaymentSplit[key]
      rows.push({
        stage: 'Design', label: PHASE_LABELS[key], dueWhen: due[key][0], reached: due[key][1], percent,
        amount: project.designValue ? (project.designValue * percent) / 100 : undefined,
      })
    }
  }
  if (project.services.execution) {
    const slabs = settings.executionPaymentSlabs
    slabs.forEach((slab, i) => {
      const done = project.status === 'Completed'
      // In between, only Accounts knows how far the site has got.
      const reached = i === 0 ? Boolean(wf.workStarted?.done) || done : done || (i === slabs.length - 1 ? false : undefined)
      rows.push({
        stage: 'Execution', label: slab.label, dueWhen: slab.label, percent: slab.percent, reached,
        amount: project.executionValue ? (project.executionValue * slab.percent) / 100 : undefined,
      })
    })
  }
  return rows
}

/** The dashboard figure: design plus execution when either is set, else the value as entered. */
export function totalValue(designValue: number | undefined, executionValue: number | undefined, fallback: number): number {
  return designValue || executionValue ? (designValue ?? 0) + (executionValue ?? 0) : fallback
}
