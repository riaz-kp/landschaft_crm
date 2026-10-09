import {
  DESIGN_PHASES,
  PHASE_LABELS,
  type DesignPhaseKey,
  type PhaseKey,
  type Project,
  type ProjectType,
} from './types'
import { daysBetween, today } from './format'

export interface PhaseProgress {
  key: PhaseKey
  label: string
  progress: number
  /** Maintenance is displayed but sits outside the progress calculation. */
  counted: boolean
}

export interface ProjectProgress {
  type: ProjectType
  design?: { phases: PhaseProgress[]; overall: number }
  execution?: { phases: PhaseProgress[]; overall: number }
  /** AMC is measured by how much of the contract term has run. It only drives the overall figure on an AMC-only project. */
  amc?: { overall: number }
  overall: number
}

const mean = (values: number[]) =>
  values.length === 0 ? 0 : Math.floor(values.reduce((a, b) => a + b, 0) / values.length)

export function projectType(project: Project): ProjectType {
  const { design, execution, amc } = project.services
  const parts = [design && 'Design', execution && 'Execution', amc && 'AMC'].filter(Boolean) as string[]
  return parts.length === 1 ? `${parts[0]} Only` : parts.join(' + ')
}

/** Share of an AMC's contract term already behind it — the project start to its expected completion. */
export function amcTermElapsed(project: Project, on: string): number {
  const total = daysBetween(project.startDate, project.expectedCompletion)
  if (total <= 0) return 100
  return Math.max(0, Math.min(100, Math.round((daysBetween(project.startDate, on) / total) * 100)))
}

/**
 * Phase → module → overall, matching the three worked examples in the
 * structure document:
 *
 *   Design only     100 / 80 / 0 / 0            → 45%
 *   Execution only  100 / 65 / 0 (+ maint. 0)   → 55%
 *   Design + Exec   design 100, execution 65    → 82%
 *
 * Disabled phases drop out entirely, so a project is only ever measured
 * against the services it actually sold. Maintenance is tracked and shown but
 * excluded from the percentage — it begins after handover.
 */
export function computeProgress(project: Project): ProjectProgress {
  const moduleScores: number[] = []
  const result: ProjectProgress = { type: projectType(project), overall: 0 }

  if (project.services.design) {
    const phases: PhaseProgress[] = DESIGN_PHASES.filter(
      (key) => project.design[key].enabled,
    ).map((key: DesignPhaseKey) => ({
      key,
      label: PHASE_LABELS[key],
      progress: project.design[key].progress,
      counted: true,
    }))
    const overall = mean(phases.map((p) => p.progress))
    result.design = { phases, overall }
    moduleScores.push(overall)
  }

  if (project.services.execution) {
    const { hardscape, softscape, mep, maintenance } = project.execution
    const phases: PhaseProgress[] = []
    if (hardscape.enabled)
      phases.push({ key: 'hardscape', label: PHASE_LABELS.hardscape, progress: hardscape.progress, counted: true })
    if (softscape.enabled)
      phases.push({ key: 'softscape', label: PHASE_LABELS.softscape, progress: softscape.progress, counted: true })
    if (mep.enabled)
      phases.push({ key: 'mep', label: PHASE_LABELS.mep, progress: mep.progress, counted: true })
    if (maintenance.enabled)
      phases.push({ key: 'maintenance', label: PHASE_LABELS.maintenance, progress: maintenance.progress, counted: false })

    const overall = mean(phases.filter((p) => p.counted).map((p) => p.progress))
    result.execution = { phases, overall }
    moduleScores.push(overall)
  }

  if (project.services.amc) {
    result.amc = { overall: amcTermElapsed(project, today()) }
    if (moduleScores.length === 0) moduleScores.push(result.amc.overall)
  }

  result.overall = mean(moduleScores)
  return result
}

/** Phases enabled on a project, for task and payment pickers. */
export function enabledPhases(project: Project): { key: PhaseKey; label: string }[] {
  const out: { key: PhaseKey; label: string }[] = []
  if (project.services.design) {
    for (const key of DESIGN_PHASES) {
      if (project.design[key].enabled) out.push({ key, label: PHASE_LABELS[key] })
    }
  }
  if (project.services.execution) {
    const { hardscape, softscape, mep, maintenance } = project.execution
    if (hardscape.enabled) out.push({ key: 'hardscape', label: PHASE_LABELS.hardscape })
    if (softscape.enabled) out.push({ key: 'softscape', label: PHASE_LABELS.softscape })
    if (mep.enabled) out.push({ key: 'mep', label: PHASE_LABELS.mep })
    if (maintenance.enabled) out.push({ key: 'maintenance', label: PHASE_LABELS.maintenance })
  }
  return out
}
