import { DESIGN_PHASES, type DesignPhaseKey, type PaymentRequest, type Phase, type PhaseKey, type Project, type Task } from './types'

/**
 * Design used to run in four phases — concept, 3D, civil work, BOQ. It now
 * runs in five: concept, presentation, design detailing in two phases, and
 * documentation. Records saved before are read in the new shape:
 *
 *   concept   → Concept
 *   3D        → Presentation
 *   civil work→ Detailing Phase 1 and Detailing Phase 2
 *   BOQ       → Documentation
 *
 * Nothing is rewritten in the database until the record is next saved.
 */
const OLD_TO_NEW: Record<string, DesignPhaseKey[]> = {
  threeD: ['presentation'],
  civilWork: ['detailing1', 'detailing2'],
  boq: ['documentation'],
}

const NOTHING: Phase = { enabled: false, progress: 0 }

/** A phase key as saved, in today's names — the first new phase for one that was split. */
export function currentPhaseKey<K extends string | undefined>(key: K): K | PhaseKey {
  return key && OLD_TO_NEW[key] ? OLD_TO_NEW[key][0] : key
}

/** A project's design phases in today's shape, whatever shape they were saved in. */
export function normalizeProjectPhases(project: Project): Project {
  const design = project.design as Record<string, Phase | undefined> | undefined
  if (!design || DESIGN_PHASES.every((key) => design[key])) return project
  const next = {} as Record<DesignPhaseKey, Phase>
  for (const key of DESIGN_PHASES) next[key] = design[key] ?? NOTHING
  for (const [old, keys] of Object.entries(OLD_TO_NEW)) {
    const was = design[old]
    if (!was) continue
    for (const key of keys) if (!design[key]) next[key] = { ...was }
  }
  // Accounts were told about these payments under the old names; keep them told.
  const flagged = project.paymentsFlagged?.flatMap((row) => {
    const old = row.startsWith('design:') ? OLD_TO_NEW[row.slice(7)] : undefined
    return old ? old.map((key) => `design:${key}`) : [row]
  })
  return { ...project, design: next, ...(flagged ? { paymentsFlagged: [...new Set(flagged)] } : {}) }
}

/** A task or payment request tagged with an old design phase, tagged with today's. */
export function normalizePhaseTag<T extends Task | PaymentRequest>(record: T): T {
  return record.phase && OLD_TO_NEW[record.phase] ? { ...record, phase: currentPhaseKey(record.phase) as PhaseKey } : record
}

/** The split new companies start with, and the one a split saved under the old phases is replaced by. */
export const DEFAULT_DESIGN_SPLIT: Record<DesignPhaseKey, number> = {
  concept: 50, presentation: 20, detailing1: 10, detailing2: 10, documentation: 10,
}

/** When each design payment is collected, in the order the phases run. */
export const DESIGN_PAYMENT_POINTS: Record<DesignPhaseKey, string> = {
  concept: 'Advance, once the scope is confirmed',
  presentation: 'Once the concept is finished',
  detailing1: 'Once the presentation is finished',
  detailing2: 'Once detailing phase 1 is finished',
  documentation: 'Once detailing phase 2 is finished',
}

/** A saved split in today's phases. One saved under the old four phases starts again from the default. */
export function normalizeDesignSplit(stored?: Partial<Record<string, number>>): Record<DesignPhaseKey, number> {
  if (!stored || !DESIGN_PHASES.every((key) => typeof stored[key] === 'number')) return { ...DEFAULT_DESIGN_SPLIT }
  return Object.fromEntries(DESIGN_PHASES.map((key) => [key, stored[key]])) as Record<DesignPhaseKey, number>
}
