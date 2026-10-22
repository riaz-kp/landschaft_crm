import { useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { addDays, formatDateLong, today } from '../../domain/format'
import {
  DESIGN_PHASES, EXECUTION_PHASES, PHASE_LABELS, type PhaseKey, type Task, type TaskPriority, type TaskStatus,
} from '../../domain/types'
import { Avatar, Field, FormError, Modal } from '../../components/ui'
import { SearchSelect } from '../../components/SearchSelect'
import { employeeOptions, projectOptions } from '../../components/pickerOptions'
import { Icon } from '../../components/Icon'
import { taskHistory } from '../projects/history'
import { TaskHistoryList } from '../projects/ProjectHistory'

export const TASK_STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Review', 'Done']
export const TASK_PRIORITIES: TaskPriority[] = ['High', 'Medium', 'Low']

const DONE_NOTE_HINT = 'What was done, and anything left over. Kept on the task and in the project history.'

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
    doneNote: task?.doneNote ?? '',
    handoverReason: '',
  })
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => { setForm({ ...form, ...patch }); setError(null) }

  const project = db.projects.find((p) => p.id === form.projectId)
  // Only the phases the project actually carries can be picked.
  const phases: PhaseKey[] = project ? [
    ...DESIGN_PHASES.filter((k) => project.services.design && project.design[k].enabled),
    ...EXECUTION_PHASES.filter((k) => project.services.execution && project.execution[k].enabled),
  ] : []
  const reassigning = Boolean(task && form.assigneeId !== task.assigneeId)
  const history = task ? taskHistory(db, task) : []
  const doneBy = task?.doneBy && db.employees.find((e) => e.id === task.doneBy)?.name

  const save = () => {
    if (!form.title.trim()) return setError('Give the task a title.')
    if (!form.projectId) return setError('Pick the project it belongs to.')
    if (!form.dueDate) return setError('Set a due date.')
    const values = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      projectId: form.projectId,
      phase: form.phase && phases.includes(form.phase) ? form.phase : undefined,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate,
      doneNote: form.status === 'Done' ? form.doneNote.trim() || undefined : undefined,
    }
    if (task) {
      // A new assignee is a hand-over: recorded with its reason before the rest is saved.
      if (reassigning) api.tasks.reassign(task.id, form.assigneeId, user.id, form.handoverReason)
      api.tasks.update(task.id, values, user.id)
    } else {
      api.tasks.create({ ...values, assigneeId: form.assigneeId }, user.id)
    }
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
          <Field label={task ? 'Assigned to — change to reassign' : 'Assigned to'}>
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
          {reassigning && (
            <div className="sm:col-span-2">
              <Field label="Reason for reassigning" hint="Optional. Saved in the project history with the hand-over.">
                <input
                  className="input" value={form.handoverReason} onChange={(e) => set({ handoverReason: e.target.value })}
                  placeholder="e.g. On leave this week, or closer to the site"
                />
              </Field>
            </div>
          )}
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
        {form.status === 'Done' && (
          <Field
            label={task?.status === 'Done' && task.doneOn
              ? <>Done note <span className="font-normal normal-case tracking-normal text-stone-400">· done {formatDateLong(task.doneOn)}{doneBy && ` by ${doneBy}`}</span></>
              : 'Done note'}
            hint={DONE_NOTE_HINT}
          >
            <textarea
              rows={3} className="input" value={form.doneNote} onChange={(e) => set({ doneNote: e.target.value })}
              placeholder="e.g. Drawings revised and shared with the client for approval"
            />
          </Field>
        )}
        <FormError message={error} />

        {history.length > 0 && (
          <div className="border-t border-stone-100 pt-4">
            <p className="label mb-3">Task history</p>
            <TaskHistoryList items={history} />
          </div>
        )}
      </div>
    </Modal>
  )
}

/** Asks for a done note as a task is moved to Done from a list or the board. */
export function TaskDoneModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const db = useDb()
  const { user } = useSession()
  const [note, setNote] = useState('')
  const project = db.projects.find((p) => p.id === task.projectId)

  const finish = () => {
    api.tasks.setStatus(task.id, 'Done', user.id, note)
    onClose()
  }

  return (
    <Modal
      title="Mark task done"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={finish} className="btn-primary"><Icon name="check" className="h-4 w-4" /> Mark done</button>
      </>}
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-stone-50 px-4 py-3">
          <p className="font-medium text-stone-900">{task.title}</p>
          <p className="mt-0.5 text-xs text-stone-500">{project?.name}{project && ` · ${project.code}`}</p>
        </div>
        <Field label="Done note" hint={DONE_NOTE_HINT}>
          <textarea
            rows={4} className="input" value={note} onChange={(e) => setNote(e.target.value)} autoFocus
            placeholder="e.g. Pergola drawings revised and sent to the client for approval"
          />
        </Field>
      </div>
    </Modal>
  )
}

/** Hands a task to someone else, with an optional reason that goes into the project history. */
export function TaskReassignModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const db = useDb()
  const { user } = useSession()
  const [toId, setToId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const current = db.employees.find((e) => e.id === task.assigneeId)
  const handovers = taskHistory(db, task).filter((h) => h.kind === 'handovers')

  const reassign = () => {
    if (!toId) return setError('Choose who takes the task over.')
    api.tasks.reassign(task.id, toId, user.id, reason)
    onClose()
  }

  return (
    <Modal
      title="Reassign task"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={reassign} className="btn-primary"><Icon name="repeat" className="h-4 w-4" /> Reassign</button>
      </>}
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-stone-50 px-4 py-3">
          <p className="font-medium text-stone-900">{task.title}</p>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-stone-600">
            <span className="text-xs text-stone-400">With</span>
            <Avatar name={current?.name ?? '?'} size="sm" src={current?.photo} />
            {current?.name ?? 'Unassigned'}
          </p>
        </div>
        <Field label="Reassign to" required>
          <SearchSelect
            value={toId}
            onChange={(id) => { setToId(id); setError(null) }}
            options={employeeOptions(db.employees.filter((e) => e.role !== 'super_admin' && e.id !== task.assigneeId))}
            placeholder="Choose a person…"
            searchPlaceholder="Search people"
            title="Reassign to"
          />
        </Field>
        <Field label="Reason" hint="Optional. Saved in the project history with the hand-over.">
          <textarea
            rows={2} className="input" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. On leave this week, or closer to the site"
          />
        </Field>
        <FormError message={error} />
        {handovers.length > 0 && (
          <div className="border-t border-stone-100 pt-4">
            <p className="label mb-3">Earlier hand-overs</p>
            <TaskHistoryList items={handovers} />
          </div>
        )}
      </div>
    </Modal>
  )
}
