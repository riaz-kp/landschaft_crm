import { addDays } from './format'
import { addMonths } from './amc'
import type { ID, Reminder, ReminderRepeat } from './types'

export const REPEAT_LABELS: Record<ReminderRepeat, string> = {
  none: 'Does not repeat', daily: 'Every day', weekly: 'Every week', monthly: 'Every month', yearly: 'Every year',
}

function next(date: string, repeat: ReminderRepeat, times: number): string {
  switch (repeat) {
    case 'daily': return addDays(date, times)
    case 'weekly': return addDays(date, times * 7)
    case 'monthly': return addMonths(date, times)
    case 'yearly': return addMonths(date, times * 12)
    default: return date
  }
}

/** Every date a reminder falls on between `from` and `to`, inclusive. */
export function reminderDates(r: Reminder, from: string, to: string): string[] {
  if (r.repeat === 'none') return r.date >= from && r.date <= to ? [r.date] : []
  const out: string[] = []
  for (let i = 0; i < 2000; i += 1) {
    const date = next(r.date, r.repeat, i)
    if (date > to || (r.until && date > r.until)) break
    if (date >= from) out.push(date)
  }
  return out
}

/** The reminders a person sees: their own, ones addressed to them, and ones for everyone. */
export function visibleTo(reminders: Reminder[], personId: ID): Reminder[] {
  return reminders.filter((r) => r.createdBy === personId || r.forIds.length === 0 || r.forIds.includes(personId))
}

export interface ReminderOccurrence {
  reminder: Reminder
  date: string
  done: boolean
}

/** Occurrences in a window, earliest first, with whether each was ticked off. */
export function occurrencesBetween(reminders: Reminder[], from: string, to: string): ReminderOccurrence[] {
  return reminders
    .flatMap((reminder) => reminderDates(reminder, from, to).map((date) => ({ reminder, date, done: reminder.doneDates.includes(date) })))
    .sort((a, b) => (a.date + (a.reminder.time ?? '')).localeCompare(b.date + (b.reminder.time ?? '')))
}
