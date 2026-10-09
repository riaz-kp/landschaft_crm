import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { formatDate, formatDateLong, today } from '../../domain/format'
import type { AmcOccurrence } from '../../domain/amc'
import type { ID } from '../../domain/types'
import { Checkbox, Field, FormError, Modal } from '../../components/ui'
import { RepeaterList } from '../../components/RepeaterList'

function TeamPicker({ value, onChange }: { value: ID[]; onChange: (ids: ID[]) => void }) {
  const db = useDb()
  return (
    <div className="grid grid-cols-2 gap-2">
      {db.workers.filter((w) => w.active).map((w) => (
        <Checkbox
          key={w.id}
          checked={value.includes(w.id)}
          onChange={(on) => onChange(on ? [...value, w.id] : value.filter((id) => id !== w.id))}
          label={<>{w.name} <span className="text-xs text-stone-400">{w.skill}</span></>}
        />
      ))}
    </div>
  )
}

/**
 * Marks a visit done. A visit booked in advance is completed in place; a date
 * straight off the repeat schedule is recorded as a new visit tied to it.
 */
export function VisitDoneModal({ occurrence: o, onClose }: { occurrence: AmcOccurrence; onClose: () => void }) {
  const db = useDb()
  const [date, setDate] = useState(o.date > today() ? today() : o.date)
  const [teamIds, setTeamIds] = useState<ID[]>(o.visit?.teamIds ?? o.record.teamIds)
  const [notes, setNotes] = useState(o.visit?.notes ?? '')
  const [issues, setIssues] = useState<string[]>(o.visit?.issues.length ? o.visit.issues : [''])
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    if (!notes.trim()) return setError('Note the work done on the visit.')
    if (teamIds.length === 0) return setError('Tick who went.')
    if (o.visit) api.amc.completeVisit(o.record.id, o.visit.id, notes.trim(), issues)
    else api.amc.recordVisit(o.record.id, { date, plannedFor: o.plannedFor, teamIds, notes: notes.trim(), issues })
    onClose()
  }

  return (
    <Modal
      title={`Visit — ${db.projects.find((p) => p.id === o.record.projectId)?.name ?? ''}`}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">Mark done</button>
      </>}
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
          {o.record.type} · planned for {formatDateLong(o.plannedFor ?? o.date)}
        </p>
        {!o.visit && (
          <Field label="Visited on">
            <input type="date" className="input" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}
        {!o.visit && (
          <div>
            <p className="label mb-2">Team</p>
            <TeamPicker value={teamIds} onChange={setTeamIds} />
          </div>
        )}
        <Field label="Work done" required>
          <textarea rows={3} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Lawn mowing, pruning, irrigation check…" />
        </Field>
        <Field label="Issues found">
          <RepeaterList values={issues} onChange={setIssues} addLabel="Add issue" placeholder="Leave blank if none" />
        </Field>
        <FormError message={error} />
      </div>
    </Modal>
  )
}

/** Moves a scheduled visit to another day — the repeat schedule carries on unchanged. */
export function MoveVisitModal({ occurrence: o, onClose }: { occurrence: AmcOccurrence; onClose: () => void }) {
  const [date, setDate] = useState(o.date < today() ? today() : o.date)
  const [teamIds, setTeamIds] = useState<ID[]>(o.visit?.teamIds ?? o.record.teamIds)
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    if (!date) return setError('Pick the new date.')
    if (teamIds.length === 0) return setError('Assign at least one person.')
    if (o.visit) api.amc.moveVisit(o.record.id, o.visit.id, date, teamIds)
    else api.amc.scheduleVisit(o.record.id, date, teamIds, o.plannedFor)
    onClose()
  }

  return (
    <Modal
      title="Move this visit"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">Move visit</button>
      </>}
    >
      <div className="space-y-4">
        <p className="text-sm text-stone-600">
          Planned for <strong>{formatDate(o.plannedFor ?? o.date)}</strong>. Moving it books the visit on the new day; later visits keep to the schedule.
        </p>
        <Field label="New date" required>
          <input type="date" className="input" value={date} min={today()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div>
          <p className="label mb-2">Team</p>
          <TeamPicker value={teamIds} onChange={setTeamIds} />
        </div>
        <FormError message={error} />
      </div>
    </Modal>
  )
}
