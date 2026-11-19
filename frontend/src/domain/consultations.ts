import { addDays } from './format'
import type { Client, Consultation, Employee, ID, Lead, RoleKey } from './types'

/** Who keeps a consultation diary: the CEO, the Design Director and the Head of Execution. */
export const CONSULTANT_ROLES: RoleKey[] = ['ceo', 'design_director', 'execution_head']

export function consultants(employees: Employee[]): Employee[] {
  return employees.filter((e) => CONSULTANT_ROLES.includes(e.role))
}

/** Whose diary a consultation is on. Bookings from before there were several diaries are the CEO's. */
export function hostOf(c: Consultation, employees: Employee[]): ID | undefined {
  return c.hostId ?? employees.find((e) => e.role === 'ceo')?.id
}

/** Every consultant a consultation is with. */
export function hostsOf(c: Consultation, employees: Employee[]): ID[] {
  if (c.hostIds?.length) return c.hostIds
  const host = hostOf(c, employees)
  return host ? [host] : []
}

/** The consultations on one person's diary — what a new booking must not clash with. */
export function onDiary(list: Consultation[], hostId: ID | undefined, employees: Employee[]): Consultation[] {
  return list.filter((c) => hostId !== undefined && hostsOf(c, employees).includes(hostId))
}

/** Everyone on a consultation: its consultants, the team members in it, and whoever booked it. */
export function consultationPeople(c: Consultation, employees: Employee[]): ID[] {
  return [...new Set([...hostsOf(c, employees), ...(c.attendeeIds ?? []), c.bookedBy])]
}

/**
 * Scheduled consultations a person is on, for their reminders: from the day
 * before until the day itself. They drop off once completed, cancelled or
 * moved to a later date. Soonest first.
 */
export function dueConsultationReminders(list: Consultation[], personId: ID, employees: Employee[], today: string): Consultation[] {
  const tomorrow = addDays(today, 1)
  return list
    .filter((c) => c.status === 'Scheduled' && c.date >= today && c.date <= tomorrow)
    .filter((c) => consultationPeople(c, employees).includes(personId))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
}

/** The consultations on any of several diaries: a booking with more than one consultant must fit all of them. */
export function onDiaries(list: Consultation[], hostIds: ID[], employees: Employee[]): Consultation[] {
  return list.filter((c) => hostsOf(c, employees).some((id) => hostIds.includes(id)))
}

/** Consultation hours. */
export const DAY_START = 9 * 60
export const DAY_END = 18 * 60
export const SLOT_MINUTES = 30
export const DURATIONS = [30, 45, 60, 90] as const

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function fromMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function endOf(c: Pick<Consultation, 'start' | 'durationMins'>): string {
  return fromMinutes(toMinutes(c.start) + c.durationMins)
}

/** Bookable start times, every half hour through the day. */
export function slotTimes(): string[] {
  const out: string[] = []
  for (let m = DAY_START; m < DAY_END; m += SLOT_MINUTES) out.push(fromMinutes(m))
  return out
}

/** The scheduled consultation a proposed slot would overlap, if any. */
export function findClash(
  existing: Consultation[], date: string, start: string, durationMins: number, ignoreId?: string,
): Consultation | undefined {
  const s = toMinutes(start)
  const e = s + durationMins
  return existing.find((c) => {
    if (c.id === ignoreId || c.date !== date || c.status !== 'Scheduled') return false
    const cs = toMinutes(c.start)
    return s < cs + c.durationMins && cs < e
  })
}

/** The earliest start on `date` that neither clashes nor runs past the end of the day. */
export function firstFreeSlot(existing: Consultation[], date: string, durationMins: number): string | undefined {
  return slotTimes().find(
    (start) => toMinutes(start) + durationMins <= DAY_END && !findClash(existing, date, start, durationMins),
  )
}

/** Who the consultation is with — the client, the lead, or the team members and others in an internal meeting. */
export function partyName(c: Consultation, clients: Client[], leads: Lead[], employees: Employee[] = []): string {
  if (c.clientId) return clients.find((x) => x.id === c.clientId)?.name ?? 'Client'
  if (c.leadId) return `${leads.find((x) => x.id === c.leadId)?.name ?? 'Lead'} (lead)`
  const names = [
    ...(c.attendeeIds ?? []).map((id) => employees.find((e) => e.id === id)?.name).filter(Boolean),
    ...(c.attendee ? [c.attendee] : []),
  ]
  return names.length ? names.join(', ') : 'Internal'
}

/**
 * Side-by-side lanes for blocks on one day of the diary, so a site visit and
 * a consultation at the same hour both stay readable. Blocks that overlap
 * share their width; the rest keep the full column.
 */
export function layoutLanes(blocks: { key: string; start: number; end: number }[]): Map<string, { lane: number; lanes: number }> {
  const out = new Map<string, { lane: number; lanes: number }>()
  let cluster: { key: string; lane: number }[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1
  const flush = () => {
    for (const c of cluster) out.set(c.key, { lane: c.lane, lanes: laneEnds.length })
    cluster = []
    laneEnds = []
  }
  for (const b of [...blocks].sort((x, y) => x.start - y.start || y.end - x.end)) {
    if (b.start >= clusterEnd) {
      flush()
      clusterEnd = b.end
    }
    let lane = laneEnds.findIndex((end) => end <= b.start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(b.end)
    } else {
      laneEnds[lane] = b.end
    }
    cluster.push({ key: b.key, lane })
    clusterEnd = Math.max(clusterEnd, b.end)
  }
  flush()
  return out
}
