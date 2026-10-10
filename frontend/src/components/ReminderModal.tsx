import { useState } from 'react'
import { api } from '../api/client'
import { useDb } from '../state/useDb'
import { useSession } from '../state/session'
import { formatDateLong, today } from '../domain/format'
import { REPEAT_LABELS } from '../domain/reminders'
import type { Reminder, ReminderRepeat } from '../domain/types'
import { Checkbox, Field, FormError, Modal } from './ui'
import { Icon } from './Icon'
import { SearchSelect } from './SearchSelect'
import { projectOptions } from './pickerOptions'

type Audience = 'me' | 'people' | 'everyone'

/**
 * Add a reminder, or open one from the calendar. A repeating reminder is
 * ticked off one date at a time; `occurrence` says which date was opened.
 */
export function ReminderModal({
  reminder, defaultDate, occurrence, onClose,
}: { reminder?: Reminder; defaultDate?: string; occurrence?: string; onClose: () => void }) {
  const db = useDb()
  const { user } = useSession()
  const canEdit = !reminder || reminder.createdBy === user.id || user.role === 'ceo' || user.role === 'super_admin'
  const [form, setForm] = useState({
    title: reminder?.title ?? '',
    date: reminder?.date ?? defaultDate ?? today(),
    time: reminder?.time ?? '',
    repeat: reminder?.repeat ?? ('none' as ReminderRepeat),
    until: reminder?.until ?? '',
    notes: reminder?.notes ?? '',
    projectId: reminder?.projectId ?? '',
    audience: (!reminder ? 'me' : reminder.forIds.length === 0 ? 'everyone' : reminder.forIds.length === 1 && reminder.forIds[0] === reminder.createdBy ? 'me' : 'people') as Audience,
    forIds: reminder?.forIds.length ? reminder.forIds : [user.id],
  })
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => { setForm({ ...form, ...patch }); setError(null) }
  const done = Boolean(reminder && occurrence && reminder.doneDates.includes(occurrence))

  const save = () => {
    if (!form.title.trim()) return setError('Say what to be reminded about.')
    if (!form.date) return setError('Pick a date.')
    if (form.audience === 'people' && form.forIds.length === 0) return setError('Pick at least one person.')
    const values = {
      title: form.title.trim(),
      date: form.date,
      time: form.time || undefined,
      repeat: form.repeat,
      until: form.repeat !== 'none' && form.until ? form.until : undefined,
      notes: form.notes.trim() || undefined,
      projectId: form.projectId || undefined,
      forIds: form.audience === 'everyone' ? [] : form.audience === 'me' ? [user.id] : [...new Set(form.forIds)],
    }
    if (reminder) api.reminders.update(reminder.id, values)
    else api.reminders.create({ ...values, createdBy: user.id, doneDates: [] })
    onClose()
  }

  return (
    <Modal
      title={reminder ? (canEdit ? 'Reminder' : reminder.title) : 'Add reminder'}
      onClose={onClose}
      footer={<>
        {reminder && canEdit && (
          <button onClick={() => { api.reminders.remove(reminder.id); onClose() }} className="btn-danger mr-auto">Delete</button>
        )}
        {reminder && occurrence && (
          <button onClick={() => { api.reminders.setDone(reminder.id, occurrence, !done); onClose() }} className="btn-secondary">
            <Icon name="check" className="h-4 w-4" /> {done ? 'Mark not done' : 'Mark done'}
          </button>
        )}
        {canEdit && <button onClick={save} className="btn-primary">{reminder ? 'Save' : 'Add reminder'}</button>}
        {!canEdit && <button onClick={onClose} className="btn-secondary">Close</button>}
      </>}
    >
      {!canEdit && reminder ? (
        <div className="space-y-2 text-sm text-stone-700">
          <p>{formatDateLong(occurrence ?? reminder.date)}{reminder.time && ` · ${reminder.time}`} · {REPEAT_LABELS[reminder.repeat]}</p>
          {reminder.notes && <p className="text-stone-500">{reminder.notes}</p>}
          <p className="text-xs text-stone-400">Added by {db.employees.find((e) => e.id === reminder.createdBy)?.name}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {occurrence && reminder?.repeat !== 'none' && (
            <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">
              Opened for {formatDateLong(occurrence)}. Changes here apply to every repeat.
            </p>
          )}
          <Field label="Remind me to" required>
            <input className="input" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Call the Greenfield association" autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date" required>
              <input type="date" className="input" value={form.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            <Field label="Time" hint="Leave empty for all day.">
              <input type="time" className="input" value={form.time} onChange={(e) => set({ time: e.target.value })} />
            </Field>
            <Field label="Repeats">
              <select className="input" value={form.repeat} onChange={(e) => set({ repeat: e.target.value as ReminderRepeat })}>
                {(Object.keys(REPEAT_LABELS) as ReminderRepeat[]).map((r) => <option key={r} value={r}>{REPEAT_LABELS[r]}</option>)}
              </select>
            </Field>
          </div>
          {form.repeat !== 'none' && (
            <Field label="Repeat until" hint="Optional — leave empty to keep repeating.">
              <input type="date" className="input sm:w-56" min={form.date} value={form.until} onChange={(e) => set({ until: e.target.value })} />
            </Field>
          )}
          <div>
            <p className="label mb-2">Who sees it</p>
            <div className="flex flex-wrap gap-2">
              {([['me', 'Only me'], ['people', 'Chosen people'], ['everyone', 'Everyone']] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => set({ audience: key })} className={`chip px-3 py-1.5 text-sm ${form.audience === key ? 'chip-on' : ''}`}>{label}</button>
              ))}
            </div>
            {form.audience === 'people' && (
              <div className="mt-3 grid max-h-40 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-stone-200 p-3">
                {db.employees.filter((e) => e.role !== 'super_admin').map((e) => (
                  <Checkbox
                    key={e.id}
                    checked={form.forIds.includes(e.id)}
                    onChange={(on) => set({ forIds: on ? [...form.forIds, e.id] : form.forIds.filter((id) => id !== e.id) })}
                    label={e.name}
                  />
                ))}
              </div>
            )}
          </div>
          <Field label="Project">
            <SearchSelect
              value={form.projectId}
              onChange={(projectId) => set({ projectId })}
              options={projectOptions(db)}
              emptyOption="Not tied to a project"
              searchPlaceholder="Search projects"
              title="Project"
            />
          </Field>
          <Field label="Notes">
            <textarea rows={2} className="input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
          <FormError message={error} />
        </div>
      )}
    </Modal>
  )
}
