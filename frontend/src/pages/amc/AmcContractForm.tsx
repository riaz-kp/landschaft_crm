import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { addDays, formatDate, formatDateLong, today } from '../../domain/format'
import { SCHEDULE_PRESETS, addMonths, describeSchedule, plannedDates } from '../../domain/amc'
import type { ID, MaintenanceRecord, RecurrenceUnit } from '../../domain/types'
import { Checkbox, Field, FormError, Modal } from '../../components/ui'
import { Icon } from '../../components/Icon'

/** Everything the AMC form edits, as plain form values. */
export interface AmcDraft {
  startDate: string
  months: number
  value: number
  every: number
  unit: RecurrenceUnit
  firstVisit: string
  reminderDaysBefore: number
  renewalReminderDays: number
  teamIds: ID[]
  scopeOfWork: string
  visitSchedule: string
}

export function emptyAmcDraft(startDate = today()): AmcDraft {
  return {
    startDate, months: 12, value: 0, every: 1, unit: 'month', firstVisit: addDays(startDate, 7),
    reminderDaysBefore: 2, renewalReminderDays: 60, teamIds: [], scopeOfWork: '', visitSchedule: '',
  }
}

export function draftFromRecord(r: MaintenanceRecord): AmcDraft {
  const months = Math.max(1, Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (30.44 * 86400000)))
  return {
    startDate: r.startDate, months, value: r.value ?? 0,
    every: r.schedule?.every ?? 1, unit: r.schedule?.unit ?? 'month',
    firstVisit: r.schedule?.firstVisit ?? r.startDate,
    reminderDaysBefore: r.schedule?.reminderDaysBefore ?? 2,
    renewalReminderDays: r.renewalReminderDays ?? 60,
    teamIds: r.teamIds, scopeOfWork: r.scopeOfWork, visitSchedule: r.visitSchedule,
  }
}

/** The contract end — a day short of `months` after the start, as an annual contract runs. */
export function endOf(d: AmcDraft): string {
  return addDays(addMonths(d.startDate, d.months), -1)
}

/** Converts form values into the record fields the API stores. */
export function draftToRecord(d: AmcDraft): Omit<MaintenanceRecord, 'id' | 'projectId' | 'type' | 'visits'> {
  const end = endOf(d)
  return {
    startDate: d.startDate,
    endDate: end,
    teamIds: d.teamIds,
    scopeOfWork: d.scopeOfWork.trim(),
    visitSchedule: d.visitSchedule.trim() || describeSchedule(d),
    schedule: { every: d.every, unit: d.unit, firstVisit: d.firstVisit, reminderDaysBefore: d.reminderDaysBefore },
    renewalDate: end,
    renewalReminderDays: d.renewalReminderDays,
    value: d.value || undefined,
  }
}

export function validateAmc(d: AmcDraft): string | null {
  if (!d.startDate) return 'Set the AMC start date.'
  if (d.months < 1) return 'The AMC must run for at least a month.'
  if (d.every < 1) return 'Visits must repeat at least every 1 day, week or month.'
  if (!d.firstVisit) return 'Pick the date of the first visit.'
  if (d.firstVisit < d.startDate || d.firstVisit > endOf(d)) return 'The first visit must fall inside the contract period.'
  if (d.teamIds.length === 0) return 'Assign at least one person to the AMC team.'
  return null
}

/**
 * The AMC contract fields: term, value, how often the site is visited and how
 * far ahead the team is reminded. A preview lists the next few visits the
 * schedule will put on the AMC calendar.
 */
export function AmcFields({ draft, onChange }: { draft: AmcDraft; onChange: (d: AmcDraft) => void }) {
  const db = useDb()
  const set = (patch: Partial<AmcDraft>) => onChange({ ...draft, ...patch })
  const preset = SCHEDULE_PRESETS.find((p) => p.every === draft.every && p.unit === draft.unit)
  const preview = plannedDates({
    id: '', projectId: '', type: 'AMC', visits: [],
    ...draftToRecord(draft),
  })
  const upcoming = preview.filter((d) => d >= today()).slice(0, 5)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="AMC starts" required>
          <input type="date" className="input" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </Field>
        <Field label="Contract length" hint={`Ends ${formatDate(endOf(draft))}`}>
          <select className="input" value={draft.months} onChange={(e) => set({ months: Number(e.target.value) })}>
            {[3, 6, 12, 24, 36].map((m) => <option key={m} value={m}>{m === 12 ? '1 year (12 months)' : m % 12 === 0 ? `${m / 12} years` : `${m} months`}</option>)}
          </select>
        </Field>
        <Field label="AMC value" hint="For the whole term, in rupees.">
          <input type="number" min={0} className="input" value={draft.value || ''} placeholder="0" onChange={(e) => set({ value: Number(e.target.value) })} />
        </Field>
      </div>

      {/* Visit frequency */}
      <div>
        <p className="label flex items-center gap-1.5"><Icon name="repeat" className="h-3.5 w-3.5" /> Visits repeat</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SCHEDULE_PRESETS.map((p) => (
            <button
              key={p.label} type="button"
              onClick={() => set({ every: p.every, unit: p.unit })}
              className={`chip px-3 py-1.5 text-sm ${preset === p ? 'chip-on' : ''}`}
            >
              {p.label}
            </button>
          ))}
          <span className={`chip gap-2 px-3 py-1 text-sm ${preset ? '' : 'border-brand-600 ring-2 ring-brand-500/20'}`}>
            Every
            <input
              type="number" min={1} max={365} value={draft.every}
              onChange={(e) => set({ every: Math.max(1, Number(e.target.value)) })}
              className="w-14 rounded-md border border-stone-300 px-1.5 py-0.5 text-center text-sm"
              aria-label="Repeat every"
            />
            <select value={draft.unit} onChange={(e) => set({ unit: e.target.value as RecurrenceUnit })} className="rounded-md border border-stone-300 px-1 py-0.5 text-sm" aria-label="Repeat unit">
              <option value="day">day(s)</option>
              <option value="week">week(s)</option>
              <option value="month">month(s)</option>
            </select>
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="First visit" required>
          <input type="date" className="input" value={draft.firstVisit} min={draft.startDate} onChange={(e) => set({ firstVisit: e.target.value })} />
        </Field>
        <Field label="Remind before each visit" hint="The visit shows in reminders this many days ahead.">
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={30} className="input w-20" value={draft.reminderDaysBefore} onChange={(e) => set({ reminderDaysBefore: Math.max(0, Number(e.target.value)) })} />
            <span className="text-sm text-stone-500">day(s)</span>
          </div>
        </Field>
        <Field label="Remind before renewal">
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={180} className="input w-20" value={draft.renewalReminderDays} onChange={(e) => set({ renewalReminderDays: Math.max(0, Number(e.target.value)) })} />
            <span className="text-sm text-stone-500">day(s)</span>
          </div>
        </Field>
      </div>

      <div className="rounded-xl border border-clay-200 bg-clay-50/50 p-3 text-sm">
        <p className="font-medium text-clay-900">
          {describeSchedule(draft)} from {formatDateLong(draft.firstVisit)} — {preview.length} visit{preview.length === 1 ? '' : 's'} over the contract.
        </p>
        {upcoming.length > 0 && (
          <p className="mt-1 text-xs text-clay-800">
            Next: {upcoming.map((d) => formatDate(d)).join(' · ')}
          </p>
        )}
      </div>

      <div>
        <p className="label">AMC team<span className="ml-0.5 text-red-500">*</span></p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {db.workers.filter((w) => w.active).map((w) => (
            <Checkbox
              key={w.id}
              checked={draft.teamIds.includes(w.id)}
              onChange={(on) => set({ teamIds: on ? [...draft.teamIds, w.id] : draft.teamIds.filter((id) => id !== w.id) })}
              label={<>{w.name} <span className="text-xs text-stone-400">{w.skill}</span></>}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Scope of work">
          <textarea rows={3} className="input" value={draft.scopeOfWork} placeholder="Lawn care, pruning, irrigation servicing, pest control…" onChange={(e) => set({ scopeOfWork: e.target.value })} />
        </Field>
        <Field label="Schedule note" hint="Anything the team should know, e.g. client prefers mornings.">
          <textarea rows={3} className="input" value={draft.visitSchedule} onChange={(e) => set({ visitSchedule: e.target.value })} />
        </Field>
      </div>
    </div>
  )
}

/** Start an AMC on an existing project, or edit a contract's term and schedule. */
export function AmcContractModal({
  record, projectId: fixedProject, onClose,
}: { record?: MaintenanceRecord; projectId?: ID; onClose: () => void }) {
  const db = useDb()
  const [projectId, setProjectId] = useState(record?.projectId ?? fixedProject ?? db.projects[0]?.id ?? '')
  const [draft, setDraft] = useState<AmcDraft>(() => (record ? draftFromRecord(record) : emptyAmcDraft()))
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    if (!projectId) return setError('Pick the project.')
    const problem = validateAmc(draft)
    if (problem) return setError(problem)
    const values = draftToRecord(draft)
    // The free month after handover has no renewal.
    if (record?.type === 'Free Maintenance') Object.assign(values, { renewalDate: undefined, renewalReminderDays: undefined })
    if (record) api.amc.update(record.id, values)
    else api.amc.create({ ...values, projectId, type: 'AMC' })
    onClose()
  }

  return (
    <Modal
      title={record ? `${record.type} — term & visit schedule` : 'New AMC contract'}
      size="xl"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">{record ? 'Save schedule' : 'Start AMC'}</button>
      </>}
    >
      <div className="space-y-5">
        {!record && !fixedProject && (
          <Field label="Project" required hint="Any project — an AMC can follow our own execution or be taken on by itself.">
            <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {db.projects.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.siteLocation}</option>)}
            </select>
          </Field>
        )}
        <AmcFields draft={draft} onChange={(d) => { setDraft(d); setError(null) }} />
        <FormError message={error} />
      </div>
    </Modal>
  )
}
