/** Kerala-based client: DD/MM/YYYY dates and Indian-format rupee amounts. */

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatDateLong(iso: string): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

/**
 * Dates are handled in the viewer's own timezone. toISOString() would convert
 * local midnight to UTC and land on the wrong calendar day for most of the
 * world, so the ISO string is assembled from local components instead.
 */
function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function today(): string {
  return toIso(new Date())
}

export function addDays(iso: string, days: number): string {
  const date = new Date(iso + 'T00:00:00')
  date.setDate(date.getDate() + days)
  return toIso(date)
}

/** Indian digit grouping — 12,50,000 rather than 1,250,000. */
export function formatCurrency(amount: number, compact = false): string {
  if (compact) {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`
  }
  return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

/** "10:00" → "10:00 AM" */
export function formatTime(hhmm: string): string {
  if (!hhmm) return '—'
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`
}

/** Minutes between two HH:mm times, floored at zero. */
export function minutesBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, eh * 60 + em - (sh * 60 + sm))
}

/** 340 → "5h 40m" — the format the client's paper report uses. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Report and dashboard counts are shown zero-padded, as in the document. */
export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
