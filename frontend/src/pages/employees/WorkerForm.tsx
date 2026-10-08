import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { today } from '../../domain/format'
import type { Worker } from '../../domain/types'
import { Checkbox, Field, FormError, Modal } from '../../components/ui'
import { PhoneWhatsAppFields } from '../../components/ContactFields'

/** Add a site worker, or edit one when `worker` is passed. */
export function WorkerFormModal({
  worker, onClose, onSaved,
}: { worker?: Worker; onClose: () => void; onSaved?: (worker: Worker) => void }) {
  const db = useDb()
  const skills = [...new Set(db.workers.map((w) => w.skill))].sort()
  const [form, setForm] = useState({
    name: worker?.name ?? '',
    skill: worker?.skill ?? '',
    phone: worker?.phone ?? '',
    whatsapp: worker?.whatsapp ?? '',
    dailyWage: worker?.dailyWage ? String(worker.dailyWage) : '',
    joinedOn: worker?.joinedOn ?? (worker ? '' : today()),
    address: worker?.address ?? '',
    emergencyContact: worker?.emergencyContact ?? '',
    notes: worker?.notes ?? '',
    active: worker?.active ?? true,
  })
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => { setForm({ ...form, ...patch }); setError(null) }

  const save = () => {
    if (!form.name.trim()) return setError('Enter the worker’s name.')
    if (!form.skill.trim()) return setError('Enter their trade or skill.')
    if (!form.phone.trim()) return setError('Enter a phone number.')
    const values = {
      name: form.name.trim(),
      skill: form.skill.trim(),
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim() || undefined,
      dailyWage: form.dailyWage ? Math.max(0, Number(form.dailyWage)) : undefined,
      joinedOn: form.joinedOn || undefined,
      address: form.address.trim() || undefined,
      emergencyContact: form.emergencyContact.trim() || undefined,
      notes: form.notes.trim() || undefined,
      active: form.active,
    }
    if (worker) {
      api.workers.update(worker.id, values)
      onSaved?.({ ...worker, ...values })
    } else {
      onSaved?.(api.workers.create(values))
    }
    onClose()
  }

  return (
    <Modal
      title={worker ? `Edit ${worker.name}` : 'Add execution worker'}
      size="lg"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">{worker ? 'Save changes' : 'Add worker'}</button>
      </>}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
          </Field>
          <Field label="Skill / trade" required>
            <input className="input" list="worker-skills" value={form.skill} placeholder="e.g. Mason" onChange={(e) => set({ skill: e.target.value })} />
            <datalist id="worker-skills">{skills.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Daily wage" hint="In rupees, per full day.">
            <input type="number" min={0} className="input" value={form.dailyWage} placeholder="0" onChange={(e) => set({ dailyWage: e.target.value })} />
          </Field>
          <Field label="Joined on">
            <input type="date" className="input" value={form.joinedOn} onChange={(e) => set({ joinedOn: e.target.value })} />
          </Field>
        </div>
        <PhoneWhatsAppFields required phone={form.phone} whatsapp={form.whatsapp} onChange={(n) => set(n)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address">
            <textarea rows={2} className="input" value={form.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label="Emergency contact" hint="Name and number.">
            <textarea rows={2} className="input" value={form.emergencyContact} onChange={(e) => set({ emergencyContact: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea rows={2} className="input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <Checkbox
          checked={form.active}
          onChange={(active) => set({ active })}
          label="Active — appears on the foremen's daily report and the attendance register"
        />
        <FormError message={error} />
      </div>
    </Modal>
  )
}
