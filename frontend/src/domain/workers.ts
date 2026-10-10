import type { DailyWorkReport, ID } from './types'

/**
 * Every skill offered on the worker form: the list kept in Settings plus any
 * skill a worker already has, so nothing in use ever drops off. Duplicates
 * that differ only in case are merged; sorted A–Z.
 */
export function workerSkills(db: { settings: { workerSkills?: string[] }; workers: { skill: string }[] }): string[] {
  const seen = new Map<string, string>()
  for (const s of [...(db.settings.workerSkills ?? []), ...db.workers.map((w) => w.skill)]) {
    const clean = s.trim()
    if (clean && !seen.has(clean.toLowerCase())) seen.set(clean.toLowerCase(), clean)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
}

/** One worker's record under a foreman: the reports they were on and the totals. */
export interface CrewMember {
  workerId: ID
  reports: DailyWorkReport[]
  /** Distinct dates on site. */
  days: number
  lastDate: string
  projectIds: ID[]
}

/**
 * The workers a foreman has had on site, from the reports that foreman filed.
 * Drafts are left out except today's, which is still being filled in.
 * Most recent first.
 */
export function crewOf(reports: DailyWorkReport[], foremanId: ID, today: string): CrewMember[] {
  const byWorker = new Map<ID, DailyWorkReport[]>()
  for (const r of reports) {
    if (r.foremanId !== foremanId || (r.status === 'Draft' && r.date !== today)) continue
    for (const a of r.attendance) {
      if (!a.present) continue
      byWorker.set(a.workerId, [...(byWorker.get(a.workerId) ?? []), r])
    }
  }
  return [...byWorker.entries()]
    .map(([workerId, list]) => {
      const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date))
      return {
        workerId,
        reports: sorted,
        days: new Set(sorted.map((r) => r.date)).size,
        lastDate: sorted[0].date,
        projectIds: [...new Set(sorted.map((r) => r.projectId))],
      }
    })
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.days - a.days)
}

/** The foremen a worker has worked under, with the reports for each. Most days first. */
export function foremenOf(reports: DailyWorkReport[], workerId: ID): { foremanId: ID; reports: DailyWorkReport[]; days: number; lastDate: string }[] {
  const byForeman = new Map<ID, DailyWorkReport[]>()
  for (const r of reports) {
    if (r.status === 'Draft') continue
    if (!r.attendance.some((a) => a.workerId === workerId && a.present)) continue
    byForeman.set(r.foremanId, [...(byForeman.get(r.foremanId) ?? []), r])
  }
  return [...byForeman.entries()]
    .map(([foremanId, list]) => {
      const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date))
      return { foremanId, reports: sorted, days: new Set(sorted.map((r) => r.date)).size, lastDate: sorted[0].date }
    })
    .sort((a, b) => b.days - a.days)
}
