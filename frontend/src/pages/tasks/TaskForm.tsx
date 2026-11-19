import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { addDays, formatDate, formatDateLong, today } from '../../domain/format'
import {
  DESIGN_PHASES, EXECUTION_PHASES, PHASE_LABELS, TASK_STATUS_LABELS, type PhaseKey, type Task, type TaskPriority, type TaskStatus,
} from '../../domain/types'
import { Avatar, Badge, Drawer, Field, FormError, Modal, ProgressBar } from '../../components/ui'
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
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
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

/** Asks for a done note as a task is moved to Completed from a list or the board. */
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
      title="Mark task completed"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={finish} className="btn-primary"><Icon name="check" className="h-4 w-4" /> Mark completed</button>
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

const STATUS_TONE: Record<TaskStatus, string> = {
  'To Do': 'bg-stone-400', 'In Progress': 'bg-amber-500', Review: 'bg-clay-500', Done: 'bg-brand-500',
}

/** How far along a task shows as: a finished one is always 100%. */
export const taskProgress = (task: Task) => (task.status === 'Done' ? 100 : Math.max(0, Math.min(100, task.progress ?? 0)))

/**
 * A task opened from a list or the board: read it in a panel on the right,
 * move its status and progress there, and open the full form with Edit.
 * Anyone who can see the task can read it; changes need edit rights on it.
 */
export function TaskDrawer({
  taskId, canEdit, onClose, onDelete,
}: {
  taskId: string
  canEdit: boolean
  onClose: () => void
  /** Offered in the edit form's footer. */
  onDelete?: (task: Task) => void
}) {
  const db = useDb()
  const { user } = useSession()
  const task = db.tasks.find((t) => t.id === taskId)
  const [mode, setMode] = useState<'read' | 'edit' | 'finish' | 'reassign'>('read')
  // The slider moves freely and is saved once it is let go.
  const [sliding, setSliding] = useState<number | null>(null)

  if (!task) return null
  const project = db.projects.find((p) => p.id === task.projectId)
  const assignee = db.employees.find((e) => e.id === task.assigneeId)
  const doneBy = task.doneBy && db.employees.find((e) => e.id === task.doneBy)?.name
  const history = taskHistory(db, task)
  const overdue = task.status !== 'Done' && task.dueDate < today()
  const progress = sliding ?? taskProgress(task)

  if (mode === 'edit') {
    return (
      <TaskFormModal
        task={task}
        onClose={() => setMode('read')}
        onDelete={onDelete ? () => { onDelete(task); onClose() } : undefined}
      />
    )
  }
  if (mode === 'finish') return <TaskDoneModal task={task} onClose={() => setMode('read')} />
  if (mode === 'reassign') return <TaskReassignModal task={task} onClose={() => setMode('read')} />

  const setStatus = (status: TaskStatus) => {
    if (status === task.status || !canEdit) return
    if (status === 'Done') setMode('finish')
    else api.tasks.setStatus(task.id, status, user.id)
  }
  const saveProgress = () => {
    if (sliding === null) return
    const value = sliding
    setSliding(null)
    if (value === taskProgress(task)) return
    // Moving a task that has not started forward puts it in progress.
    const patch: Partial<Task> = { progress: value }
    if (value > 0 && task.status === 'To Do') patch.status = 'In Progress'
    api.tasks.update(task.id, patch, user.id)
  }

  const row = (label: string, value: ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-wider text-stone-400">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-stone-800">{value}</dd>
    </div>
  )

  return (
    <Drawer
      title={<span className={task.status === 'Done' ? 'text-stone-500 line-through' : ''}>{task.title}</span>}
      subtitle={project ? (
        <Link to={`/projects/${project.id}?tab=tasks`} onClick={onClose} className="inline-flex items-center gap-1 hover:text-brand-700">
          {project.name} · <span className="font-mono text-xs">{project.code}</span>
          <Icon name="chevron" className="h-3.5 w-3.5" />
        </Link>
      ) : undefined}
      onClose={onClose}
      footer={canEdit && <>
        {task.status !== 'Done' && (
          <button onClick={() => setMode('reassign')} className="btn-secondary mr-auto"><Icon name="repeat" className="h-4 w-4" /> Reassign</button>
        )}
        <button onClick={() => setMode('edit')} className="btn-primary"><Icon name="edit" className="h-4 w-4" /> Edit</button>
      </>}
    >
      <div className="space-y-6">
        <div>
          <p className="label mb-2">Status</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Status">
            {TASK_STATUSES.map((status) => (
              <button
                key={status} type="button" role="radio" aria-checked={task.status === status}
                disabled={!canEdit}
                onClick={() => setStatus(status)}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition disabled:cursor-default ${
                  task.status === status ? 'bg-stone-900 text-white shadow-sm' : 'border border-stone-200 bg-white text-stone-600 enabled:hover:bg-stone-50'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${STATUS_TONE[status]}`} /> {TASK_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="label">Progress</p>
            <span className="text-lg font-bold tabular-nums text-stone-900">{progress}%</span>
          </div>
          {canEdit && task.status !== 'Done' ? (
            <>
              <input
                type="range" min={0} max={100} step={5} value={progress}
                onChange={(e) => setSliding(Number(e.target.value))}
                onPointerUp={saveProgress} onKeyUp={saveProgress} onBlur={saveProgress}
                className="w-full accent-brand-600"
                aria-label="Progress"
              />
              <div className="mt-1 flex justify-between gap-1">
                {[0, 25, 50, 75, 100].map((v) => (
                  <button
                    key={v} type="button"
                    onClick={() => {
                      if (v === 100) return setMode('finish')
                      const patch: Partial<Task> = { progress: v }
                      if (v > 0 && task.status === 'To Do') patch.status = 'In Progress'
                      api.tasks.update(task.id, patch, user.id)
                    }}
                    className={`rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${progress === v ? 'bg-brand-100 text-brand-800' : 'text-stone-500 hover:bg-stone-100'}`}
                    title={v === 100 ? 'Mark completed' : undefined}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </>
          ) : (
            <ProgressBar value={progress} />
          )}
        </div>

        <dl className="divide-y divide-stone-100 border-y border-stone-100">
          {row('Project', project ? (
            <Link to={`/projects/${project.id}?tab=tasks`} onClick={onClose} className="font-medium text-brand-700 hover:text-brand-800 hover:underline">
              {project.name}
            </Link>
          ) : '—')}
          {row('Phase', task.phase ? PHASE_LABELS[task.phase] : 'General')}
          {row('Assigned to', (
            <span className="inline-flex items-center gap-2">
              <Avatar name={assignee?.name ?? '?'} size="sm" src={assignee?.photo} /> {assignee?.name ?? 'Unassigned'}
            </span>
          ))}
          {row('Due', (
            <span className={overdue ? 'font-semibold text-red-700' : task.dueDate === today() ? 'font-semibold text-amber-700' : ''}>
              {task.dueDate === today() ? 'Today' : formatDate(task.dueDate)}
              {overdue && <span className="ml-1.5"><Badge tone="red">Overdue</Badge></span>}
            </span>
          ))}
          {row('Priority', <Badge tone={task.priority === 'High' ? 'red' : task.priority === 'Medium' ? 'amber' : 'stone'}>{task.priority}</Badge>)}
          {task.fromReportId && row('From', 'A daily work report')}
        </dl>

        {task.description && (
          <div>
            <p className="label mb-1">Details</p>
            <p className="whitespace-pre-line text-sm text-stone-700">{task.description}</p>
          </div>
        )}

        {task.status === 'Done' && (
          <div className="rounded-xl bg-brand-50/70 px-4 py-3">
            <p className="label text-brand-800">
              Done{task.doneOn && <> · {formatDateLong(task.doneOn)}</>}{doneBy && <> by {doneBy}</>}
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-stone-700">{task.doneNote || <span className="text-stone-400">No done note.</span>}</p>
          </div>
        )}

        {history.length > 0 && (
          <div>
            <p className="label mb-3">Task history</p>
            <TaskHistoryList items={history} />
          </div>
        )}
      </div>
    </Drawer>
  )
}
