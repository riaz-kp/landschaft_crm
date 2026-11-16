import type { ID, Project } from './types'

/** Codes are kept upper-case with no stray spaces, so "lnd26101 " and "LND26101" are the same code. */
export function normaliseCode(code: string): string {
  return code.trim().replace(/\s+/g, '-').toUpperCase()
}

/** Each year's series starts at this number: LND26101 is the first project of 2026. */
const FIRST_IN_YEAR = 101

/**
 * The next free code in the company's series: LND, the year's last two
 * digits, then a running number from 101 — LND26101, LND26102… One past the
 * highest number used that year, so deleting a project never hands its code
 * to the next one. Codes from the earlier LS-2026-001 series are left as they
 * are and do not count.
 */
export function suggestProjectCode(projects: Project[], year = new Date().getFullYear()): string {
  const prefix = `LND${String(year % 100).padStart(2, '0')}`
  const highest = projects
    .map((p) => normaliseCode(p.code))
    .filter((code) => code.startsWith(prefix) && /^\d+$/.test(code.slice(prefix.length)))
    .map((code) => Number(code.slice(prefix.length)))
    .reduce((max, n) => Math.max(max, n), FIRST_IN_YEAR - 1)
  return `${prefix}${highest + 1}`
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
