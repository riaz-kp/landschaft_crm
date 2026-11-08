import { DESIGN_PHASES, PHASE_LABELS } from './types'
import type { Employee, Project, RoleKey, Settings, SlabDue, WorkflowStepKey } from './types'

const SITE_PHASES = ['hardscape', 'softscape', 'mep'] as const

/**
 * One hand-off on the way from an enquiry to work starting on site. Ticking a
 * step tells the people who act next, through a reminder on their bell.
 * Accounts hears about the payments a step brings due from the payment
 * schedule below, once for each payment, rather than from the step.
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
    owners: ['ceo', 'design_director'], notify: ['design_pm'],
    notice: () => 'Scope confirmed — allocate the design work',
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
    owners: DESIGN_ROLES, notify: [],
    notice: () => 'Concept finished',
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
    owners: EXECUTION_ROLES, notify: [],
    notice: () => 'Work started on site',
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

/** What each choice of "collect when" for an execution slab means, as Settings and the schedule word it. */
export const SLAB_DUE_LABELS: Record<SlabDue, string> = {
  workStarted: 'Work starts on site',
  hardscape: 'Hardscape reaches 100%',
  softscape: 'Softscape reaches 100%',
  mep: 'MEP reaches 100%',
  completed: 'Project marked Completed',
}

export interface ScheduleRow {
  /** Stable across edits to the project, e.g. "design:threeD" or "execution:Hardscape complete". */
  key: string
  stage: 'Design' | 'Execution'
  label: string
  /** The point it is collected at, e.g. "Scope confirmed". */
  dueWhen: string
  percent: number
  amount?: number
  /** Whether that point has been reached. */
  reached: boolean
}

/**
 * What the client pays and when: the design value split by phase and the
 * execution value by slab, both from Settings. Each design phase is paid for
 * up front — the concept as the advance once the scope is confirmed, the 3D
 * once the concept is finished, and so on. Each execution slab falls due at
 * the point Settings gives it: work starting, a phase reaching 100%, or the
 * project being completed. A slab tied to a phase this project does not have
 * falls due at completion.
 */
export function paymentSchedule(project: Project, settings: Settings): ScheduleRow[] {
  const rows: ScheduleRow[] = []
  const wf = project.workflow ?? {}
  const completed = project.status === 'Completed'
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
        key: `design:${key}`, stage: 'Design', label: PHASE_LABELS[key], dueWhen: due[key][0], reached: due[key][1], percent,
        amount: project.designValue ? (project.designValue * percent) / 100 : undefined,
      })
    }
  }
  if (project.services.execution) {
    // Ticked on the Workflow tab, or progress recorded on site work (maintenance only follows handover).
    const started = Boolean(wf.workStarted?.done)
      || SITE_PHASES.some((phase) => project.execution[phase].enabled && project.execution[phase].progress > 0)
    for (const slab of settings.executionPaymentSlabs) {
      let reached = completed
      let dueWhen = SLAB_DUE_LABELS[slab.dueAt]
      if (slab.dueAt === 'workStarted') {
        reached ||= started
      } else if (slab.dueAt !== 'completed') {
        const phase = project.execution[slab.dueAt]
        if (phase.enabled) reached ||= phase.progress >= 100
        else dueWhen = `${SLAB_DUE_LABELS.completed} (no ${PHASE_LABELS[slab.dueAt]} on this project)`
      }
      rows.push({
        key: `execution:${slab.label}`, stage: 'Execution', label: slab.label, dueWhen, percent: slab.percent, reached,
        amount: project.executionValue ? (project.executionValue * slab.percent) / 100 : undefined,
      })
    }
  }
  return rows
}

export interface CollectionRow extends ScheduleRow {
  /** What is still to come in for this row, once what was received is set against the rows in order. */
  outstanding?: number
  collected: boolean
}

/**
 * Sets what the client has paid against the schedule, earliest row first, so
 * each row says whether it is collected and how much of it is still owed. A row
 * with no value set cannot be counted, and is never shown as collected.
 */
export function withCollection(rows: ScheduleRow[], received: number): CollectionRow[] {
  let left = received
  return rows.map((row) => {
    if (row.amount === undefined) return { ...row, collected: false }
    const paid = Math.max(0, Math.min(row.amount, left))
    left -= paid
    const outstanding = row.amount - paid
    return { ...row, outstanding, collected: outstanding < 0.5 }
  })
}

/** The dashboard figure: design plus execution when either is set, else the value as entered. */
export function totalValue(designValue: number | undefined, executionValue: number | undefined, fallback: number): number {
  return designValue || executionValue ? (designValue ?? 0) + (executionValue ?? 0) : fallback
}
