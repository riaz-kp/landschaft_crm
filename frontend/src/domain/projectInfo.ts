import type { ID, Project } from './types'

/** Codes are kept upper-case with no stray spaces, so "ls-2026-9 " and "LS-2026-9" are the same code. */
export function normaliseCode(code: string): string {
  return code.trim().replace(/\s+/g, '-').toUpperCase()
}

/**
 * The next free code in the company's LS-YEAR-NNN series — one past the
 * highest number used that year, so deleting a project never hands its code
 * to the next one.
 */
export function suggestProjectCode(projects: Project[], year = new Date().getFullYear()): string {
  const prefix = `LS-${year}-`
  const highest = projects
    .map((p) => (p.code.toUpperCase().startsWith(prefix) ? Number(p.code.slice(prefix.length)) : 0))
    .filter((n) => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0)
  return `${prefix}${String(highest + 1).padStart(3, '0')}`
}

/** The project already using this code, if any. */
export function codeOwner(projects: Project[], code: string, exceptId?: ID): Project | undefined {
  const wanted = normaliseCode(code)
  return projects.find((p) => p.id !== exceptId && normaliseCode(p.code) === wanted)
}

/** "4,500 sq ft", "18 cents" — or an empty string when no area is recorded. */
export function formatArea(project: Pick<Project, 'area' | 'areaUnit'>): string {
  if (!project.area) return ''
  return `${project.area.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${project.areaUnit ?? 'sq ft'}`
}
