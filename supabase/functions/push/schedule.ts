// What to push, to whom, and when. The same items the header bell shows
// (frontend/src/components/NotificationBell.tsx), timed for India:
//
//   Reminders        at their time on the day, or 9:00 AM when they have none.
//                    A hand-off notice (new task, payment due…) goes out within
//                    a minute of being sent, as its time has already come.
//   Site visits      8:00 AM on the day the reminder opens ("1 day before"…),
//                    and again at 8:00 AM on the day of the visit.
//   Consultations    6:00 PM the day before, and an hour before it starts.
//
// Something whose time came earlier today still goes out until the day ends,
// unless the person it is for made it after that time themselves. Each push
// has a key, so nobody gets the same one twice.
//
// Keep in step with domain/reminders.ts, siteVisits.ts and consultations.ts.

export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Reminder {
  id: string
  title: string
  date: string
  time?: string
  repeat: ReminderRepeat
  until?: string
  notes?: string
  createdBy: string
  forIds: string[]
  notice?: boolean
  link?: string
  doneDates: string[]
}

export interface SiteVisit {
  id: string
  leadId?: string
  clientId?: string
  location: string
  date: string
  time?: string
  assignedTo: string
  teamIds?: string[]
  remindDaysBefore?: number
  status: string
}

export interface Consultation {
  id: string
  hostId?: string
  hostIds?: string[]
  attendeeIds?: string[]
  date: string
  start: string
  durationMins: number
  purpose: string
  clientId?: string
  leadId?: string
  attendee?: string
  mode: string
  location?: string
  bookedBy: string
  status: string
}

export interface Person {
  id: string
  name: string
  role: string
}

export interface Push {
  /** Unique per item and occurrence; the recipient's id is added when sending. */
  key: string
  to: string[]
  title: string
  body: string
  /** The CRM page a tap opens. */
  url: string
}

export interface ScheduleInput {
  now: number
  people: Person[]
  /** Each reminder with when its row was created (ms). */
  reminders: { reminder: Reminder; createdAt: number }[]
  visits: SiteVisit[]
  consultations: Consultation[]
  /** Lead and client names by id. */
  names: Map<string, string>
}

const IST_OFFSET = (5 * 60 + 30) * 60_000

/** The date in India at an instant, YYYY-MM-DD. */
export function indiaDate(ms: number): string {
  return new Date(ms + IST_OFFSET).toISOString().slice(0, 10)
}

/** The instant of HH:mm on a date in India. */
export function indiaInstant(date: string, hhmm: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  return Date.UTC(y, m - 1, d, h, min) - IST_OFFSET
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Same day of the month, or the month's last day when it is shorter (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))).toISOString().slice(0, 10)
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function formatDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = Math.max(0, h * 60 + m + minutes)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Whether a reminder falls on `date` (domain/reminders.ts reminderDates, for one day). */
export function fallsOn(r: Reminder, date: string): boolean {
  if (r.repeat === 'none') return r.date === date
  if (date < r.date || (r.until && date > r.until)) return false
  for (let i = 0; i < 5000; i += 1) {
    const next = r.repeat === 'daily' ? addDays(r.date, i)
      : r.repeat === 'weekly' ? addDays(r.date, i * 7)
        : r.repeat === 'monthly' ? addMonths(r.date, i)
          : addMonths(r.date, i * 12)
    if (next === date) return true
    if (next > date) return false
  }
  return false
}

/** Who sees a reminder (domain/reminders.ts visibleTo). "Everyone" is the office: foremen do not see reminders. */
function reminderPeople(r: Reminder, people: Person[]): string[] {
  if (r.forIds.length === 0) return people.filter((p) => p.role !== 'foreman').map((p) => p.id)
  return [...new Set([...r.forIds, ...(r.notice ? [] : [r.createdBy])])]
}

/** The consultants on a consultation; older bookings with none are the CEO's (domain/consultations.ts hostsOf). */
function hostsOf(c: Consultation, people: Person[]): string[] {
  if (c.hostIds?.length) return c.hostIds
  const host = c.hostId ?? people.find((p) => p.role === 'ceo')?.id
  return host ? [host] : []
}

function partyName(c: Consultation, names: Map<string, string>, people: Person[]): string {
  if (c.clientId) return names.get(c.clientId) ?? 'Client'
  if (c.leadId) return `${names.get(c.leadId) ?? 'Lead'} (lead)`
  const internal = [
    ...(c.attendeeIds ?? []).map((id) => people.find((p) => p.id === id)?.name).filter(Boolean),
    ...(c.attendee ? [c.attendee] : []),
  ]
  return internal.length ? internal.join(', ') : 'Internal'
}

const clip = (text: string, max = 240) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** Every push due right now. */
export function duePushes(input: ScheduleInput): Push[] {
  const { now, people, names } = input
  const today = indiaDate(now)
  const tomorrow = addDays(today, 1)
  const endOfToday = indiaInstant(tomorrow, '00:00')
  const due = (at: number, until = endOfToday) => at <= now && now < until
  const out: Push[] = []

  for (const { reminder: r, createdAt } of input.reminders) {
    if (!fallsOn(r, today) || r.doneDates.includes(today)) continue
    const at = indiaInstant(today, r.time ?? '09:00')
    if (!due(at)) continue
    // Your own reminder, made after its time today: you have just seen it.
    const to = reminderPeople(r, people).filter((id) => !(id === r.createdBy && createdAt > at))
    if (!to.length) continue
    const when = r.time ? `Today at ${formatTime(r.time)}` : 'Today'
    out.push({
      key: `reminder:${r.id}:${today}`,
      to,
      title: clip(r.title, 120),
      body: clip(r.notice ? (r.notes || when) : [when, r.notes].filter(Boolean).join(' · ')),
      url: r.link || '/calendar',
    })
  }

  for (const v of input.visits) {
    if (v.status !== 'Scheduled' || v.remindDaysBefore === undefined || v.date < today) continue
    const opensOn = addDays(v.date, -v.remindDaysBefore)
    if (today !== opensOn && today !== v.date) continue
    if (!due(indiaInstant(today, '08:00'))) continue
    // A visit already over (booked late in the day) needs no reminder.
    if (today === v.date && v.time && now > indiaInstant(v.date, v.time)) continue
    const day = v.date === today ? 'Today' : v.date === tomorrow ? 'Tomorrow' : formatDay(v.date)
    out.push({
      key: `visit:${v.id}:${v.date}:${today}`,
      to: [...new Set([v.assignedTo, ...(v.teamIds ?? [])])],
      title: clip(`Site visit — ${(v.leadId && names.get(v.leadId)) || (v.clientId && names.get(v.clientId)) || 'site'}`, 120),
      body: clip(`${day}${v.time ? ` at ${formatTime(v.time)}` : ''} · ${v.location}`),
      url: '/consultations/site-visits',
    })
  }

  for (const c of input.consultations) {
    if (c.status !== 'Scheduled' || (c.date !== today && c.date !== tomorrow)) continue
    const to = [...new Set([...hostsOf(c, people), ...(c.attendeeIds ?? []), c.bookedBy])]
    const end = addMinutes(c.start, c.durationMins)
    const where = c.mode === 'Site' && c.location ? ` · ${c.location}` : c.mode !== 'Office' ? ` · ${c.mode}` : ''
    const base = {
      to,
      title: clip(`Consultation — ${c.purpose}`, 120),
      url: '/consultations',
    }
    const details = `${formatTime(c.start)}–${formatTime(end)} · ${partyName(c, names, people)}${where}`
    if (c.date === tomorrow && due(indiaInstant(today, '18:00'))) {
      out.push({ ...base, key: `consultation:${c.id}:${c.date}:${c.start}:eve`, body: clip(`Tomorrow ${details}`) })
    }
    const starts = indiaInstant(c.date, c.start)
    if (c.date === today && due(starts - 60 * 60_000, starts)) {
      out.push({ ...base, key: `consultation:${c.id}:${c.date}:${c.start}:soon`, body: clip(`Today ${details}`) })
    }
  }

  return out
}
