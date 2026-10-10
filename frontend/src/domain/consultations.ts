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
