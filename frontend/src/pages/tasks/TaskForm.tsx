import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { addDays, today } from '../../domain/format'
import {
  DESIGN_PHASES, EXECUTION_PHASES, PHASE_LABELS, type PhaseKey, type Task, type TaskPriority, type TaskStatus,
} from '../../domain/types'
import { Field, FormError, Modal } from '../../components/ui'
import { SearchSelect } from '../../components/SearchSelect'
import { employeeOptions, projectOptions } from '../../components/pickerOptions'

export const TASK_STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Review', 'Done']
export const TASK_PRIORITIES: TaskPriority[] = ['High', 'Medium', 'Low']

/** Create a task, or edit one when `task` is passed. */
export function TaskFormModal({
  task, defaults, onClose, onDelete,
}: {
  task?: Task
  defaults?: Partial<Task>
  onClose: () => void
  /** Shown as a Delete button in the footer when editing. */
  onDelete?: () => void
}) {
  const db = useDb()
  const { user } = useSession()
  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    projectId: task?.projectId ?? defaults?.projectId ?? db.projects.find((p) => p.status !== 'Completed')?.id ?? '',
    phase: (task?.phase ?? defaults?.phase ?? '') as PhaseKey | '',
    assigneeId: task?.assigneeId ?? defaults?.assigneeId ?? user.id,
    status: task?.status ?? defaults?.status ?? ('To Do' as TaskStatus),
    priority: task?.priority ?? ('Medium' as TaskPriority),
    dueDate: task?.dueDate ?? defaults?.dueDate ?? addDays(today(), 3),
  })
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => { setForm({ ...form, ...patch }); setError(null) }

  const project = db.projects.find((p) => p.id === form.projectId)
  // Only the phases the project actually carries can be picked.
  const phases: PhaseKey[] = project ? [
    ...DESIGN_PHASES.filter((k) => project.services.design && project.design[k].enabled),
    ...EXECUTION_PHASES.filter((k) => project.services.execution && project.execution[k].enabled),
  ] : []

  const save = () => {
    if (!form.title.trim()) return setError('Give the task a title.')
    if (!form.projectId) return setError('Pick the project it belongs to.')
    if (!form.dueDate) return setError('Set a due date.')
    const values = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      projectId: form.projectId,
      phase: form.phase && phases.includes(form.phase) ? form.phase : undefined,
      assigneeId: form.assigneeId,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate,
    }
    if (task) api.tasks.update(task.id, values)
    else api.tasks.create(values)
    onClose()
  }

  return (
    <Modal
      title={task ? 'Edit task' : 'New task'}
      size="lg"
      onClose={onClose}
      footer={<>
        {task && onDelete && <button onClick={onDelete} className="btn-danger mr-auto">Delete</button>}
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">{task ? 'Save changes' : 'Create task'}</button>
      </>}
    >
      <div className="space-y-4">
        <Field label="Title" required>
          <input className="input" value={form.title} onChange={(e) => set({ title: e.target.value })} autoFocus placeholder="What needs doing" />
        </Field>
        <Field label="Details">
          <textarea rows={3} className="input" value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project" required>
            <SearchSelect
              value={form.projectId}
              onChange={(projectId) => set({ projectId, phase: '' })}
              options={projectOptions(db)}
              placeholder="Choose a project…"
              searchPlaceholder="Search by name, code, site or client"
              title="Project"
            />
          </Field>
          <Field label="Phase">
            <select className="input" value={form.phase} onChange={(e) => set({ phase: e.target.value as PhaseKey | '' })}>
              <option value="">General</option>
              {phases.map((k) => <option key={k} value={k}>{PHASE_LABELS[k]}</option>)}
            </select>
          </Field>
          <Field label="Assigned to">
            <SearchSelect
              value={form.assigneeId}
              onChange={(assigneeId) => set({ assigneeId })}
              options={employeeOptions(db.employees.filter((e) => e.role !== 'super_admin'))}
              searchPlaceholder="Search people"
              title="Assign to"
            />
          </Field>
          <Field label="Due date" required>
            <input type="date" className="input" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
          </Field>
          <Field label="Priority">
            <div className="flex gap-2">
              {TASK_PRIORITIES.map((p) => (
                <button
                  key={p} type="button" onClick={() => set({ priority: p })}
                  className={`chip flex-1 justify-center py-2 text-sm ${form.priority === p ? 'chip-on' : ''}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => set({ status: e.target.value as TaskStatus })}>
              {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <FormError message={error} />
      </div>
    </Modal>
  )
}
