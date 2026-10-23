import { DESIGN_PHASES, MEP_LABELS, MEP_SERVICES, PHASE_LABELS, type DesignPhaseKey, type Project } from './types'

/**
 * A project's scope: the services sold and the phases each carries. Chosen on
 * New Project and changeable later from Edit Project.
 */
export interface ProjectScope {
  services: { design: boolean; execution: boolean; amc: boolean }
  designPhases: Record<DesignPhaseKey, boolean>
  executionPhases: {
    hardscape: boolean
    softscape: boolean
    mep: boolean
    irrigation: boolean
    electrical: boolean
    drainage: boolean
  }
}

export function newScope(): ProjectScope {
  return {
    services: { design: true, execution: false, amc: false },
    designPhases: { concept: true, threeD: true, civilWork: true, boq: true },
    executionPhases: { hardscape: true, softscape: true, mep: false, irrigation: false, electrical: false, drainage: false },
  }
}

/**
 * The scope a project carries now. A service that is off offers its usual
 * phases ticked, so switching it on starts from the normal set.
 */
export function scopeOf(project: Project): ProjectScope {
  const { design, execution, amc } = project.services
  const { hardscape, softscape, mep } = project.execution
  const fresh = newScope()
  return {
    services: { design, execution, amc: Boolean(amc) },
    designPhases: design
      ? Object.fromEntries(DESIGN_PHASES.map((key) => [key, project.design[key].enabled])) as ProjectScope['designPhases']
      : fresh.designPhases,
    executionPhases: execution
      ? {
          hardscape: hardscape.enabled, softscape: softscape.enabled, mep: mep.enabled,
          irrigation: mep.enabled && mep.services.irrigation,
          electrical: mep.enabled && mep.services.electrical,
          drainage: mep.enabled && mep.services.drainage,
        }
      : fresh.executionPhases,
  }
}

/** Why the scope cannot be saved, or null when it can. */
export function scopeProblem({ services, designPhases, executionPhases: ex }: ProjectScope): string | null {
  if (!services.design && !services.execution && !services.amc) return 'Select at least one service — Design, Execution or AMC.'
  if (services.design && !Object.values(designPhases).some(Boolean)) return 'Select at least one design phase.'
  if (services.execution && !ex.hardscape && !ex.softscape && !ex.mep) return 'Select at least one execution phase.'
  if (services.execution && ex.mep && !ex.irrigation && !ex.electrical && !ex.drainage) {
    return 'Select at least one MEP service, or turn MEP off.'
  }
  return null
}

const NO_PROGRESS = { enabled: false, progress: 0 }

/**
 * The services and phases for a scope. Phases that stay keep their progress;
 * a phase switched off keeps it too, so switching it back on picks up where
 * it was. Without `current` every phase starts at nothing.
 */
export function applyScope(scope: ProjectScope, current?: Pick<Project, 'design' | 'execution'>): Pick<Project, 'services' | 'design' | 'execution'> {
  const { services, designPhases, executionPhases: ex } = scope
  const was = current?.execution
  return {
    services: { ...services },
    design: Object.fromEntries(DESIGN_PHASES.map((key) => [
      key, { ...(current?.design[key] ?? NO_PROGRESS), enabled: services.design && designPhases[key] },
    ])) as Project['design'],
    execution: {
      hardscape: { ...(was?.hardscape ?? NO_PROGRESS), enabled: services.execution && ex.hardscape },
      softscape: { ...(was?.softscape ?? NO_PROGRESS), enabled: services.execution && ex.softscape },
      mep: {
        ...(was?.mep ?? NO_PROGRESS),
        enabled: services.execution && ex.mep,
        services: { irrigation: ex.mep && ex.irrigation, electrical: ex.mep && ex.electrical, drainage: ex.mep && ex.drainage },
      },
      // Maintenance follows execution automatically — the free month.
      maintenance: { ...(was?.maintenance ?? NO_PROGRESS), enabled: services.execution },
    },
  }
}

/** "Concept, 3D Presentation, Hardscape, MEP (Irrigation)" — for the project history. */
export function describePhases(project: Pick<Project, 'design' | 'execution'>): string {
  const design = DESIGN_PHASES.filter((key) => project.design[key].enabled).map((key) => PHASE_LABELS[key])
  const { hardscape, softscape, mep } = project.execution
  const execution = [
    hardscape.enabled && PHASE_LABELS.hardscape,
    softscape.enabled && PHASE_LABELS.softscape,
    mep.enabled && `MEP (${MEP_SERVICES.filter((s) => mep.services[s]).map((s) => MEP_LABELS[s]).join(', ')})`,
  ].filter(Boolean)
  return [...design, ...execution].join(', ')
}
