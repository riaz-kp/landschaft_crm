import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { usePermissions } from '../../state/permissions'
import { can } from '../../domain/roles'
import { visitPeople, visitSubject } from '../../domain/siteVisits'
import { addDays, formatDate, formatDateLong, formatTime, today } from '../../domain/format'
import {
  DAY_END, DAY_START, DURATIONS, SLOT_MINUTES, endOf, findClash, firstFreeSlot, partyName, slotTimes,
  toMinutes,
} from '../../domain/consultations'
import type { Consultation } from '../../domain/types'
import {
  PageHeader, Section, EmptyState, Badge, StatusBadge, StatTile, Modal, Field, FormError,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { SearchSelect } from '../../components/SearchSelect'
import { clientOptions, leadOptions } from '../../components/pickerOptions'

const MODES: Consultation['mode'][] = ['Office', 'Site', 'Phone', 'Video']
/** One pixel per minute keeps the arithmetic obvious: a 60-minute meeting is 60px tall. */
const PX_PER_MIN = 1

function mondayOf(iso: string): string {
  const day = new Date(iso + 'T00:00:00').getDay()
  return addDays(iso, -((day + 6) % 7))
}

const isSunday = (iso: string) => new Date(iso + 'T00:00:00').getDay() === 0

/** The diary shows Monday to Saturday, so on a Sunday "this week" means the coming one. */
function currentWeekStart(): string {
  return isSunday(today()) ? addDays(today(), 1) : mondayOf(today())
}

type Draft = { date: string; start: string }

/**
 * The CEO's consultation diary. Every role can see it and book a slot; the
 * CEO's office marks consultations done or cancels them.
 */
export function Consultations() {
  const db = useDb()
  const { user, roleKey } = useSession()
  const { canView } = usePermissions()
  const [weekStart, setWeekStart] = useState(currentWeekStart)
  const [booking, setBooking] = useState<Draft | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const ceo = db.employees.find((e) => e.role === 'ceo')
  // Monday to Saturday — Sunday is the weekly off.
  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i))
  // A phone shows one day of the week at a time rather than a grid to scroll sideways.
  const [phoneDay, setPhoneDay] = useState(today)
  const focusDay = days.includes(phoneDay) ? phoneDay : days[0]
  const scheduled = db.consultations.filter((c) => c.status === 'Scheduled')
  const upcoming = scheduled
    .filter((c) => c.date >= today())
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  const past = db.consultations
    .filter((c) => c.status !== 'Scheduled')
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))
  const todays = upcoming.filter((c) => c.date === today())
  const thisWeek = scheduled.filter((c) => c.date >= days[0] && c.date <= addDays(weekStart, 6))
  const bookedMinutes = thisWeek.reduce((s, c) => s + c.durationMins, 0)
  const capacity = 6 * (DAY_END - DAY_START)

  const name = (c: Consultation) => partyName(c, db.clients, db.leads)
  const staffName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'
  const opened = db.consultations.find((c) => c.id === openId)
  const siteVisits = db.siteVisits
    .filter((v) => v.status === 'Scheduled' && v.date >= today())
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))

  return (
    <div>
      <PageHeader
        title="Consultations"
        subtitle={`${ceo?.name ?? 'The CEO'}'s consultation diary. Everyone can see it and book a slot.`}
        actions={<button onClick={() => {
          const base = today() < days[0] ? days[0] : today()
          const date = isSunday(base) ? addDays(base, 1) : base
          setBooking({ date, start: firstFreeSlot(db.consultations, date, 60) ?? '10:00' })
        }} className="btn-primary">
          <Icon name="plus" className="h-4 w-4" /> Book consultation
        </button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Today" value={todays.length} sub={todays[0] ? `Next at ${formatTime(todays[0].start)}` : 'Nothing booked'} />
        <StatTile label="This Week" value={thisWeek.length} />
        <StatTile label="Week Booked" value={`${Math.round((bookedMinutes / capacity) * 100)}%`} sub={`${Math.round(bookedMinutes / 60)}h of consultation hours`} />
        <StatTile label="Upcoming" value={upcoming.length} tone="blue" sub={`${upcoming.filter((c) => c.postponements?.length).length} postponed`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-4">
        <Section
          className="xl:col-span-3"
          title={`${formatDateLong(days[0])} – ${formatDateLong(days[5])}`}
          description="Click a free slot to book it."
          actions={
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="btn-secondary px-3" aria-label="Previous week">‹</button>
              <button onClick={() => setWeekStart(currentWeekStart())} className="btn-secondary">This week</button>
              <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="btn-secondary px-3" aria-label="Next week">›</button>
            </div>
          }
        >
          <div className="grid grid-cols-6 gap-1 border-b border-stone-100 p-2 md:hidden">
            {days.map((date) => (
              <button
                key={date}
                type="button"
                onClick={() => setPhoneDay(date)}
                className={`flex flex-col items-center rounded-lg py-1.5 text-[11px] font-semibold leading-tight ${
                  date === focusDay ? 'bg-brand-600 text-white' : date === today() ? 'bg-brand-50 text-brand-800' : 'text-stone-500'
                }`}
              >
                <span>{new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                <span className="tabular-nums">{formatDate(date).slice(0, 2)}</span>
                {scheduled.some((c) => c.date === date) && <span className={`mt-0.5 h-1 w-1 rounded-full ${date === focusDay ? 'bg-white' : 'bg-brand-500'}`} />}
              </button>
            ))}
          </div>
          <div className="scroll-x">
            <div className="flex md:min-w-[720px]">
              {/* Hour labels */}
              <div className="w-14 shrink-0 border-r border-stone-100 pt-10">
                {Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60).map((m) => (
                  <div key={m} style={{ height: 60 * PX_PER_MIN }} className="pr-2 text-right text-[11px] tabular-nums text-stone-400">
                    {formatTime(`${String(m / 60).padStart(2, '0')}:00`).replace(':00 ', ' ')}
                  </div>
                ))}
              </div>
              {days.map((date) => {
                const events = scheduled.filter((c) => c.date === date)
                const isToday = date === today()
                return (
                  <div key={date} className={`${date === focusDay ? '' : 'hidden md:block'} min-w-0 flex-1 border-r border-stone-100 last:border-r-0`}>
                    <div className={`flex h-10 flex-col items-center justify-center border-b border-stone-200 text-xs ${isToday ? 'bg-brand-50 font-bold text-brand-800' : 'font-semibold text-stone-500'}`}>
                      <span>{new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                      <span className="tabular-nums">{formatDate(date).slice(0, 5)}</span>
                    </div>
                    <div className="relative" style={{ height: (DAY_END - DAY_START) * PX_PER_MIN }}>
                      {slotTimes().map((start) => {
                        const pastSlot = date < today()
                        return (
                          <button
                            key={start}
                            type="button"
                            disabled={pastSlot}
                            onClick={() => setBooking({ date, start })}
                            style={{ height: SLOT_MINUTES * PX_PER_MIN }}
                            className={`block w-full border-b border-dashed border-stone-100 ${pastSlot ? 'cursor-default bg-stone-50/60' : 'hover:bg-brand-50'}`}
                            aria-label={`Book ${formatDate(date)} at ${start}`}
                          />
                        )
                      })}
                      {events.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setOpenId(c.id)}
                          style={{
                            top: (toMinutes(c.start) - DAY_START) * PX_PER_MIN,
                            height: Math.max(24, c.durationMins * PX_PER_MIN - 2),
                          }}
                          className={`absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm ${
                            c.bookedBy === user.id ? 'border-clay-500 bg-clay-50 text-clay-900' : 'border-brand-600 bg-brand-50 text-brand-900'
                          } hover:brightness-95`}
                        >
                          <span className="block font-semibold tabular-nums">{c.start}–{endOf(c)}</span>
                          <span className="block truncate">{c.purpose}</span>
                          <span className="block truncate opacity-70">{c.postponements?.length ? "↻ " : ""}{name(c)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <p className="border-t border-stone-100 px-5 py-2.5 text-xs text-stone-400">
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-clay-400 align-middle" /> booked by you
            <span className="ml-4 mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-500 align-middle" /> booked by others
          </p>
        </Section>

        <div className="space-y-6">
          <Section title="Upcoming">
            {upcoming.length === 0 ? (
              <EmptyState title="Nothing booked." />
            ) : (
              <ul className="divide-y divide-stone-100">
                {upcoming.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setOpenId(c.id)} className="block w-full px-5 py-3 text-left hover:bg-stone-50">
                      <p className="text-xs font-semibold tabular-nums text-brand-700">
                        {c.date === today() ? 'Today' : formatDateLong(c.date)} · {formatTime(c.start)}
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-stone-800">{c.purpose}</p>
                      <p className="text-xs text-stone-400">{name(c)} · {c.mode} · booked by {staffName(c.bookedBy)}</p>
                      {c.postponements?.length ? <span className="mt-1 inline-block"><Badge tone="violet">Postponed from {formatDate(c.postponements[0].fromDate)}</Badge></span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {canView('Site Visits') && (
            <Section
              title="Site Visits"
              description={siteVisits.length ? `${siteVisits.length} coming up` : undefined}
              actions={<Link to="/consultations/site-visits" className="text-sm font-semibold text-brand-700">All visits</Link>}
            >
              {siteVisits.length === 0 ? (
                <EmptyState title="No site visits coming up." icon="pin" />
              ) : (
                <ul className="divide-y divide-stone-100">
                  {siteVisits.slice(0, 5).map((v) => {
                    const people = visitPeople(v)
                    return (
                      <li key={v.id}>
                        <Link to="/consultations/site-visits" className="block px-5 py-3 hover:bg-stone-50">
                          <p className="text-xs font-semibold tabular-nums text-clay-700">
                            {v.date === today() ? 'Today' : formatDateLong(v.date)}{v.time && ` · ${formatTime(v.time)}`}
                          </p>
                          <p className="mt-0.5 text-sm font-medium text-stone-800">{visitSubject(v, db.leads, db.clients)}</p>
                          <p className="text-xs text-stone-400">
                            {v.location} · {staffName(v.assignedTo)}{people.length > 1 && ` + ${people.length - 1}`}
                            {people.includes(user.id) && <span className="ml-1.5 font-semibold text-clay-700">· you're on it</span>}
                          </p>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Section>
          )}

          <Section title="Recent">
            {past.length === 0 ? (
              <EmptyState title="No past consultations." />
            ) : (
              <ul className="divide-y divide-stone-100">
                {past.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setOpenId(c.id)} className="flex w-full items-start justify-between gap-2 px-5 py-3 text-left hover:bg-stone-50">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-stone-800">{c.purpose}</span>
                        <span className="block text-xs text-stone-400">{formatDate(c.date)} · {name(c)}</span>
                      </span>
                      <StatusBadge status={c.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {booking && <BookingModal draft={booking} onClose={() => setBooking(null)} />}
      {opened && (
        <DetailsModal
          consultation={opened}
          canManage={can.manageConsultations(roleKey)}
          isBooker={opened.bookedBy === user.id}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

function BookingModal({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const db = useDb()
  const { user } = useSession()
  const [form, setForm] = useState({
    date: draft.date,
    start: draft.start,
    durationMins: 60,
    party: 'Client' as 'Client' | 'Lead' | 'Other',
    clientId: db.clients[0]?.id ?? '',
    leadId: db.leads.find((l) => !['Won', 'Lost'].includes(l.status))?.id ?? '',
    attendee: '',
    purpose: '',
    mode: 'Office' as Consultation['mode'],
    notes: '',
  })
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => { setForm({ ...form, ...patch }); setError(null) }

  const clash = findClash(db.consultations, form.date, form.start, form.durationMins)
  const overruns = toMinutes(form.start) + form.durationMins > DAY_END

  const save = () => {
    if (!form.purpose.trim()) return setError('Say what the consultation is about.')
    if (form.date < today()) return setError('Pick today or a later date.')
    if (isSunday(form.date)) return setError('Sunday is the weekly off — pick another day.')
    if (overruns) return setError('That runs past 6:00 PM. Pick an earlier time or a shorter slot.')
    if (clash) return setError(`Clashes with "${clash.purpose}" (${clash.start}–${endOf(clash)}).`)
    if (form.party === 'Other' && !form.attendee.trim()) return setError('Enter who the meeting is with.')
    api.consultations.create({
      date: form.date,
      start: form.start,
      durationMins: form.durationMins,
      purpose: form.purpose.trim(),
      clientId: form.party === 'Client' ? form.clientId : undefined,
      leadId: form.party === 'Lead' ? form.leadId : undefined,
      attendee: form.party === 'Other' ? form.attendee.trim() : undefined,
      mode: form.mode,
      bookedBy: user.id,
      notes: form.notes.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal
      title="Book a consultation with the CEO"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">Book slot</button>
      </>}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date" required>
            <input type="date" min={today()} className="input" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="Start" required>
            <select className="input" value={form.start} onChange={(e) => set({ start: e.target.value })}>
              {slotTimes().map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
            </select>
          </Field>
          <Field label="Length">
            <select className="input" value={form.durationMins} onChange={(e) => set({ durationMins: Number(e.target.value) })}>
              {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </Field>
        </div>
        {(clash || overruns) && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {clash
              ? <>Taken: <strong>{clash.purpose}</strong> runs {formatTime(clash.start)}–{formatTime(endOf(clash))}.</>
              : 'This slot runs past 6:00 PM.'}
          </p>
        )}

        <div>
          <p className="label">With</p>
          <div className="mt-2 flex gap-2">
            {(['Client', 'Lead', 'Other'] as const).map((p) => (
              <button
                key={p} type="button" onClick={() => set({ party: p })}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${form.party === p ? 'bg-brand-600 text-white' : 'border border-stone-300 bg-white text-stone-600 hover:bg-stone-50'}`}
              >
                {p === 'Other' ? 'Internal / other' : p}
              </button>
            ))}
          </div>
          <div className="mt-2">
            {form.party === 'Client' && (
              <SearchSelect
                value={form.clientId}
                onChange={(clientId) => set({ clientId })}
                options={clientOptions(db.clients)}
                searchPlaceholder="Search clients by name, phone or place"
                ariaLabel="Client"
                title="Client"
              />
            )}
            {form.party === 'Lead' && (
              <SearchSelect
                value={form.leadId}
                onChange={(leadId) => set({ leadId })}
                options={leadOptions(db.leads.filter((l) => l.status !== 'Lost'))}
                searchPlaceholder="Search leads"
                ariaLabel="Lead"
                title="Lead"
              />
            )}
            {form.party === 'Other' && (
              <input className="input" placeholder="e.g. Arshad, Anaswara" value={form.attendee} onChange={(e) => set({ attendee: e.target.value })} aria-label="Attendee" />
            )}
          </div>
        </div>

        <Field label="Purpose" required>
          <input className="input" value={form.purpose} onChange={(e) => set({ purpose: e.target.value })} placeholder="What needs the CEO's time" />
        </Field>
        <Field label="Where">
          <select className="input" value={form.mode} onChange={(e) => set({ mode: e.target.value as Consultation['mode'] })}>
            {MODES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Notes for the CEO">
          <textarea rows={2} className="input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}

function DetailsModal({
  consultation: c, canManage, isBooker, onClose,
}: { consultation: Consultation; canManage: boolean; isBooker: boolean; onClose: () => void }) {
  const db = useDb()
  const { user } = useSession()
  const [notes, setNotes] = useState(c.notes ?? '')
  const [postponing, setPostponing] = useState(false)
  const scheduled = c.status === 'Scheduled'
  const canChange = scheduled && (canManage || isBooker)

  const finish = (status: Consultation['status']) => {
    api.consultations.setStatus(c.id, status, notes.trim() || undefined)
    onClose()
  }

  if (postponing) {
    return <PostponeModal consultation={c} byId={user.id} onClose={() => setPostponing(false)} onDone={onClose} />
  }

  const staffName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'

  return (
    <Modal
      title={c.purpose}
      onClose={onClose}
      footer={canChange ? <>
        <button onClick={() => finish('Cancelled')} className="btn-danger mr-auto">
          {canManage ? 'Cancel consultation' : 'Cancel my booking'}
        </button>
        <button onClick={() => setPostponing(true)} className="btn-secondary">
          <Icon name="postpone" className="h-4 w-4" /> Postpone
        </button>
        {canManage && <button onClick={() => finish('Completed')} className="btn-primary">Mark completed</button>}
      </> : undefined}
    >
      <dl className="grid gap-4 sm:grid-cols-2">
        {[
          ['When', `${formatDateLong(c.date)} · ${formatTime(c.start)}–${formatTime(endOf(c))}`],
          ['With', partyName(c, db.clients, db.leads)],
          ['Where', c.mode],
          ['Booked by', staffName(c.bookedBy)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="label">{label}</dt>
            <dd className="mt-1 text-sm text-stone-800">{value}</dd>
          </div>
        ))}
        <div>
          <dt className="label">Status</dt>
          <dd className="mt-1 flex gap-1.5">
            <StatusBadge status={c.status} />
            {c.postponements?.length ? <Badge tone="violet">Postponed ×{c.postponements.length}</Badge> : null}
          </dd>
        </div>
      </dl>

      {c.postponements?.length ? (
        <div className="mt-4 rounded-xl bg-violet-50/60 p-3">
          <p className="label mb-2 text-violet-700">Postponement history</p>
          <ol className="space-y-2">
            {c.postponements.map((p, i) => (
              <li key={i} className="text-sm text-stone-700">
                <span className="tabular-nums text-stone-500 line-through">{formatDate(p.fromDate)} {formatTime(p.fromStart)}</span>
                {' → '}
                <span className="font-medium tabular-nums">{formatDate(p.toDate)} {formatTime(p.toStart)}</span>
                <span className="block text-xs text-stone-500">
                  {p.reason} — {staffName(p.by)}, {formatDate(p.at.slice(0, 10))}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="mt-4">
        {scheduled && canManage ? (
          <Field label="Notes">
            <textarea rows={3} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Outcome, decisions, follow-ups…" />
          </Field>
        ) : c.notes ? (
          <>
            <p className="label">Notes</p>
            <p className="mt-1 text-sm text-stone-700">{c.notes}</p>
          </>
        ) : null}
      </div>
      {scheduled && !canManage && !isBooker && (
        <p className="mt-4"><Badge tone="stone">Only the CEO's office or the person who booked can change this.</Badge></p>
      )}
    </Modal>
  )
}

/** Moves a consultation to another free slot, keeping a note of why. */
function PostponeModal({
  consultation: c, byId, onClose, onDone,
}: { consultation: Consultation; byId: string; onClose: () => void; onDone: () => void }) {
  const db = useDb()
  const firstDay = (() => {
    let d = c.date < today() ? today() : addDays(c.date, 1)
    if (isSunday(d)) d = addDays(d, 1)
    return d
  })()
  const [date, setDate] = useState(firstDay)
  const [start, setStart] = useState(() => firstFreeSlot(db.consultations.filter((x) => x.id !== c.id), firstDay, c.durationMins) ?? c.start)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const clash = findClash(db.consultations, date, start, c.durationMins, c.id)
  const overruns = toMinutes(start) + c.durationMins > DAY_END
  const free = slotTimes().filter((t) => toMinutes(t) + c.durationMins <= DAY_END && !findClash(db.consultations, date, t, c.durationMins, c.id))

  const save = () => {
    if (date < today()) return setError('Pick today or a later date.')
    if (isSunday(date)) return setError('Sunday is the weekly off — pick another day.')
    if (date === c.date && start === c.start) return setError('Pick a different date or time.')
    if (overruns) return setError('That runs past 6:00 PM. Pick an earlier time.')
    if (clash) return setError(`Clashes with "${clash.purpose}" (${clash.start}–${endOf(clash)}).`)
    if (!reason.trim()) return setError('Say why it is being postponed — the other side will ask.')
    api.consultations.postpone(c.id, date, start, reason.trim(), byId)
    onDone()
  }

  return (
    <Modal
      title="Postpone consultation"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Back</button>
        <button onClick={save} className="btn-primary"><Icon name="postpone" className="h-4 w-4" /> Postpone</button>
      </>}
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-stone-50 p-3 text-sm">
          <p className="font-medium text-stone-900">{c.purpose}</p>
          <p className="mt-0.5 text-stone-500">
            Currently {formatDateLong(c.date)} · {formatTime(c.start)}–{formatTime(endOf(c))} · {c.durationMins} min
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New date" required>
            <input
              type="date" min={today()} className="input" value={date}
              onChange={(e) => {
                const d = e.target.value
                setDate(d)
                setError(null)
                const slot = firstFreeSlot(db.consultations.filter((x) => x.id !== c.id), d, c.durationMins)
                if (slot) setStart(slot)
              }}
            />
          </Field>
          <Field label="New start" required>
            <select className="input" value={start} onChange={(e) => { setStart(e.target.value); setError(null) }}>
              {slotTimes().map((t) => (
                <option key={t} value={t} disabled={!free.includes(t)}>
                  {formatTime(t)}{free.includes(t) ? '' : ' — taken'}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {isSunday(date) && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Sunday is the weekly off.</p>}
        {!isSunday(date) && free.length === 0 && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">That day is fully booked — try another day.</p>
        )}
        <Field label="Reason" required>
          <textarea rows={2} className="input" value={reason} placeholder="e.g. Client travelling — asked to move to next week" onChange={(e) => { setReason(e.target.value); setError(null) }} />
        </Field>
        <FormError message={error} />
      </div>
    </Modal>
  )
}
