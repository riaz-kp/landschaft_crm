import { addDays, formatDateLong, formatTime } from './format'
import type { Client, ID, Lead, SiteVisit } from './types'

/** Lead times offered for a site visit reminder, in days before the visit. */
export const REMIND_OPTIONS: { days: number; label: string }[] = [
  { days: 0, label: 'On the day' },
  { days: 1, label: '1 day before' },
  { days: 2, label: '2 days before' },
  { days: 3, label: '3 days before' },
  { days: 7, label: '1 week before' },
]

export function remindLabel(days: number | undefined): string {
  if (days === undefined) return 'No reminder'
  return REMIND_OPTIONS.find((o) => o.days === days)?.label ?? `${days} days before`
}

/** Everyone on a visit: the person leading it first, then the rest of the group. */
export function visitPeople(v: Pick<SiteVisit, 'assignedTo' | 'teamIds'>): ID[] {
  return [...new Set([v.assignedTo, ...(v.teamIds ?? [])])]
}

export function isOnVisit(v: Pick<SiteVisit, 'assignedTo' | 'teamIds'>, personId: ID): boolean {
  return visitPeople(v).includes(personId)
}

/** Who or what the visit is for — the lead's or client's name. */
export function visitSubject(v: Pick<SiteVisit, 'leadId' | 'clientId'>, leads: Lead[], clients: Client[]): string {
  if (v.leadId) return leads.find((l) => l.id === v.leadId)?.name ?? '—'
  if (v.clientId) return clients.find((c) => c.id === v.clientId)?.name ?? '—'
  return '—'
}

/**
 * Scheduled visits a person is on whose reminder window has opened: from
 * `remindDaysBefore` days ahead until the day itself. Soonest first.
 */
export function dueVisitReminders(visits: SiteVisit[], personId: ID, today: string): SiteVisit[] {
  return visits
    .filter((v) => v.status === 'Scheduled' && v.remindDaysBefore !== undefined && isOnVisit(v, personId))
    .filter((v) => v.date >= today && addDays(v.date, -(v.remindDaysBefore ?? 0)) <= today)
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
}

/** The message sent to someone on the visit when they are reminded over WhatsApp. */
export function visitReminderText(v: SiteVisit, subject: string, leaderName: string): string {
  const when = `${formatDateLong(v.date)}${v.time ? ` at ${formatTime(v.time)}` : ''}`
  return [
    `Reminder: site visit for ${subject} on ${when}.`,
    `Location: ${v.location}.`,
    `Led by ${leaderName}.`,
    v.notes ? `Notes: ${v.notes}` : '',
  ].filter(Boolean).join('\n')
}
