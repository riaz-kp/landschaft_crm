import type { Client, Consultation, Lead } from './types'

/** The CEO's consultation hours. */
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

/** Who the consultation is with — the client, the lead, or the free-text attendee. */
export function partyName(c: Consultation, clients: Client[], leads: Lead[]): string {
  if (c.clientId) return clients.find((x) => x.id === c.clientId)?.name ?? 'Client'
  if (c.leadId) return `${leads.find((x) => x.id === c.leadId)?.name ?? 'Lead'} (lead)`
  return c.attendee || 'Internal'
}
