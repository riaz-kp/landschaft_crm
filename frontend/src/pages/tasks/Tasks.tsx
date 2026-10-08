import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { usePermissions } from '../../state/permissions'
import { addDays, formatDate, formatDateLong, today } from '../../domain/format'
import { PHASE_LABELS, type Task, type TaskStatus } from '../../domain/types'
import {
  PageHeader, Section, StatusBadge, Table, EmptyState, Badge, Avatar, RowActions, ConfirmDialog,
  SearchInput, StatTile,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { TASK_PRIORITIES, TASK_STATUSES, TaskFormModal } from './TaskForm'

// ---------------------------------------------------------------- time filter

export type Period = 'all' | 'today' | 'week' | 'month' | 'overdue' | 'custom'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'custom', label: 'Custom range' },
]

/** Monday-to-Sunday range containing `iso`. */
function weekRange(iso: string): [string, string] {
  const offset = (new Date(iso + 'T00:00:00').getDay() + 6) % 7
  const start = addDays(iso, -offset)
  return [start, addDays(start, 6)]
}

interface Filters {
  period: Period
  from: string
  to: string
  projectId: string
  assigneeId: string
  priority: string
  query: string
}

const EMPTY: Filters = { period: 'all', from: today(), to: addDays(today(), 6), projectId: '', assigneeId: '', priority: '', query: '' }

/** The window a period covers, by due date; undefined means no limit. */
function periodRange(f: Filters): [string, string] | undefined {
  const t = today()
  switch (f.period) {
    case 'today': return [t, t]
    case 'week': return weekRange(t)
    case 'month': return [`${t.slice(0, 7)}-01`, `${t.slice(0, 7)}-31`]
    case 'custom': return [f.from <= f.to ? f.from : f.to, f.from <= f.to ? f.to : f.from]
    default: return undefined
  }
}

function applyFilters(tasks: Task[], f: Filters, projectName: (id: string) => string): Task[] {
  const range = periodRange(f)
  const q = f.query.trim().toLowerCase()
  return tasks.filter((t) => {
    if (f.period === 'overdue' && !(t.status !== 'Done' && t.dueDate < today())) return false
    if (range && (t.dueDate < range[0] || t.dueDate > range[1])) return false
    if (f.projectId && t.projectId !== f.projectId) return false
    if (f.assigneeId && t.assigneeId !== f.assigneeId) return false
    if (f.priority && t.priority !== f.priority) return false
    if (q && !t.title.toLowerCase().includes(q) && !projectName(t.projectId).toLowerCase().includes(q)) return false
    return true
  })
}

function FilterBar({
  filters, setFilters, showAssignee, total, shown,
}: { filters: Filters; setFilters: (f: Filters) => void; showAssignee?: boolean; total: number; shown: number }) {
  const db = useDb()
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch })
  const range = periodRange(filters)
  const active = filters.period !== 'all' || filters.projectId || filters.assigneeId || filters.priority || filters.query

  return (
    <div className="card mb-5 space-y-3 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => set({ period: p.key })}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                filters.period === p.key ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <SearchInput value={filters.query} onChange={(query) => set({ query })} placeholder="Search tasks or projects…" className="xl:w-72" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters.period === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" className="input w-auto py-1.5" value={filters.from} onChange={(e) => set({ from: e.target.value })} aria-label="From" />
            <span className="text-sm text-stone-400">to</span>
            <input type="date" className="input w-auto py-1.5" value={filters.to} onChange={(e) => set({ to: e.target.value })} aria-label="To" />
          </div>
        )}
        <select className="input w-auto py-1.5" value={filters.projectId} onChange={(e) => set({ projectId: e.target.value })} aria-label="Project">
          <option value="">All projects</option>
          {db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {showAssignee && (
          <select className="input w-auto py-1.5" value={filters.assigneeId} onChange={(e) => set({ assigneeId: e.target.value })} aria-label="Assignee">
            <option value="">Everyone</option>
            {db.employees.filter((e) => e.role !== 'super_admin').map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
        <select className="input w-auto py-1.5" value={filters.priority} onChange={(e) => set({ priority: e.target.value })} aria-label="Priority">
          <option value="">Any priority</option>
          {TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <span className="ml-auto text-xs text-stone-500">
          {range && filters.period !== 'today' && <>Due {formatDateLong(range[0])} – {formatDateLong(range[1])} · </>}
          {filters.period === 'today' && <>Due today · </>}
          Showing <strong className="text-stone-800">{shown}</strong> of {total}
        </span>
        {active && (
          <button onClick={() => setFilters(EMPTY)} className="text-xs font-semibold text-brand-700 hover:text-brand-800">
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- shared list page

/** Opens the task named in `?open=` (the header search links here). */
function useOpenFromUrl(setEditing: (t: Task) => void) {
  const db = useDb()
  const [params, setParams] = useSearchParams()
  const open = params.get('open')
  useEffect(() => {
    if (!open) return
    const task = db.tasks.find((t) => t.id === open)
    if (task) setEditing(task)
    setParams({}, { replace: true })
  }, [open])
}

function TaskList({
  title, subtitle, scope, showAssignee,
}: { title: string; subtitle: string; scope: (t: Task) => boolean; showAssignee?: boolean }) {
  const db = useDb()
  const { user } = useSession()
  const { can } = usePermissions()
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  useOpenFromUrl(setEditing)

  const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? ''
  const scoped = db.tasks.filter(scope)
  const tasks = applyFilters(scoped, filters, projectName)
    .sort((a, b) => (a.status === 'Done') === (b.status === 'Done') ? a.dueDate.localeCompare(b.dueDate) : a.status === 'Done' ? 1 : -1)

  const open = scoped.filter((t) => t.status !== 'Done')
  const overdue = open.filter((t) => t.dueDate < today())
  const dueToday = open.filter((t) => t.dueDate === today())
  const [ws, we] = weekRange(today())
  const thisWeek = open.filter((t) => t.dueDate >= ws && t.dueDate <= we)

  const canEdit = (t: Task) => can('Tasks', 'edit') || t.assigneeId === user.id

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={can('Tasks', 'create') && (
          <button onClick={() => setEditing('new')} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> New task</button>
        )}
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Open" value={open.length} icon="check" />
        <StatTile label="Due Today" value={dueToday.length} tone={dueToday.length ? 'amber' : 'stone'} icon="clock" />
        <StatTile label="Due This Week" value={thisWeek.length} tone="blue" icon="calendar" />
        <StatTile label="Overdue" value={overdue.length} tone={overdue.length ? 'red' : 'green'} icon="alert" />
      </div>

      <FilterBar filters={filters} setFilters={setFilters} showAssignee={showAssignee} total={scoped.length} shown={tasks.length} />

      <Section>
        {tasks.length === 0 ? (
          <EmptyState title="No tasks match these filters." icon="check" />
        ) : (
          <Table head={['Task', 'Project', ...(showAssignee ? ['Assignee'] : []), 'Due', 'Priority', 'Status', '']}>
            {tasks.map((task) => {
              const overdueTask = task.status !== 'Done' && task.dueDate < today()
              const assignee = db.employees.find((e) => e.id === task.assigneeId)
              return (
                <tr key={task.id} className="row-hover">
                  <td className="td">
                    <button onClick={() => canEdit(task) && setEditing(task)} className="text-left">
                      <span className={`font-medium ${task.status === 'Done' ? 'text-stone-400 line-through' : 'text-stone-900'} hover:text-brand-700`}>{task.title}</span>
                    </button>
                    <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-stone-400">
                      {task.phase && <span>{PHASE_LABELS[task.phase]}</span>}
                      {task.fromReportId && <span>from daily report</span>}
                    </span>
                  </td>
                  <td className="td">
                    <Link to={`/projects/${task.projectId}`} className="hover:text-brand-700">{projectName(task.projectId) || '—'}</Link>
                  </td>
                  {showAssignee && (
                    <td className="td">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <Avatar name={assignee?.name ?? '?'} size="sm" src={assignee?.photo} />
                        {assignee?.name ?? <span className="text-stone-400">Unassigned</span>}
                      </span>
                    </td>
                  )}
                  <td className="td whitespace-nowrap tabular-nums">
                    <span className={overdueTask ? 'font-semibold text-red-700' : task.dueDate === today() ? 'font-semibold text-amber-700' : ''}>
                      {task.dueDate === today() ? 'Today' : formatDate(task.dueDate)}
                    </span>
                    {overdueTask && <span className="ml-1.5"><Badge tone="red">Overdue</Badge></span>}
                  </td>
                  <td className="td">
                    <Badge tone={task.priority === 'High' ? 'red' : task.priority === 'Medium' ? 'amber' : 'stone'}>{task.priority}</Badge>
                  </td>
                  <td className="td">
                    <select
                      value={task.status}
                      disabled={!canEdit(task)}
                      onChange={(e) => api.tasks.setStatus(task.id, e.target.value as TaskStatus)}
                      className="input w-32 py-1 text-xs"
                      aria-label={`Status for ${task.title}`}
                    >
                      {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="td">
                    <RowActions
                      onEdit={canEdit(task) ? () => setEditing(task) : undefined}
                      onDelete={can('Tasks', 'delete') ? () => setDeleting(task) : undefined}
                    />
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Section>

      {editing && (
        <TaskFormModal
          task={editing === 'new' ? undefined : editing}
          defaults={{ assigneeId: showAssignee ? undefined : user.id }}
          onClose={() => setEditing(null)}
          onDelete={editing !== 'new' && can('Tasks', 'delete') ? () => { setDeleting(editing); setEditing(null) } : undefined}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this task?"
          message={<>“{deleting.title}” will be removed from {projectName(deleting.projectId) || 'its project'}.</>}
          onClose={() => setDeleting(null)}
          onConfirm={() => api.tasks.remove(deleting.id)}
        />
      )}
    </div>
  )
}

export function MyTasks() {
  const { user } = useSession()
  return (
    <TaskList
      title="My Tasks"
      subtitle={`Everything assigned to ${user.name}.`}
      scope={(t) => t.assigneeId === user.id}
    />
  )
}

export function TeamTasks() {
  const db = useDb()
  const { user, roleKey } = useSession()
  // Design and execution leads see their own department's work.
  const department = db.employees.find((e) => e.id === user.id)?.department
  const teamIds = ['super_admin', 'ceo'].includes(roleKey)
    ? db.employees.map((e) => e.id)
    : db.employees.filter((e) => e.department === department).map((e) => e.id)
  return (
    <TaskList
      title="Team Tasks"
      subtitle={['super_admin', 'ceo'].includes(roleKey) ? 'Everything assigned across the company.' : `Everything assigned across the ${department} team.`}
      scope={(t) => teamIds.includes(t.assigneeId)}
      showAssignee
    />
  )
}

export function AllTasks() {
  return (
    <TaskList
      title="All Tasks"
      subtitle="Every task on every project, whoever it is assigned to."
      scope={() => true}
      showAssignee
    />
  )
}

// ---------------------------------------------------------------- board

const COLUMN_TONE: Record<TaskStatus, string> = {
  'To Do': 'bg-stone-400',
  'In Progress': 'bg-amber-500',
  Review: 'bg-clay-500',
  Done: 'bg-brand-500',
}

export function TaskBoard() {
  const db = useDb()
  const { user } = useSession()
  const { can } = usePermissions()
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [editing, setEditing] = useState<Task | { status: TaskStatus } | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<TaskStatus | null>(null)

  const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? ''
  const tasks = applyFilters(db.tasks, filters, projectName)
  const canEdit = (t: Task) => can('Tasks', 'edit') || t.assigneeId === user.id

  return (
    <div>
      <PageHeader
        title="Task Board"
        subtitle="Every task by stage. Drag a card to move it; click it to edit."
        actions={can('Tasks', 'create') && (
          <button onClick={() => setEditing({ status: 'To Do' })} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> New task</button>
        )}
      />

      <FilterBar filters={filters} setFilters={setFilters} showAssignee total={db.tasks.length} shown={tasks.length} />

      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
        {TASK_STATUSES.map((status) => {
          const column = tasks
            .filter((t) => t.status === status)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
          return (
            <div
              key={status}
              onDragOver={(e) => { e.preventDefault(); setOver(status) }}
              onDragLeave={() => setOver((o) => (o === status ? null : o))}
              onDrop={(e) => {
                e.preventDefault()
                if (dragging) api.tasks.setStatus(dragging, status)
                setDragging(null)
                setOver(null)
              }}
              className={`w-[78vw] max-w-[320px] shrink-0 snap-start rounded-2xl p-3 transition sm:w-72 lg:w-auto lg:max-w-none ${
                over === status ? 'bg-brand-100/70 ring-2 ring-brand-400' : 'bg-stone-200/50'
              }`}
            >
              <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-bold text-stone-700">
                <span className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${COLUMN_TONE[status]}`} /> {status}
                </span>
                <span className="flex items-center gap-1">
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs tabular-nums text-stone-500">{column.length}</span>
                  {can('Tasks', 'create') && (
                    <button onClick={() => setEditing({ status })} className="btn-icon h-6 w-6" aria-label={`Add task to ${status}`}>
                      <Icon name="plus" className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              </h2>
              <div className="min-h-24 space-y-2">
                {column.map((task) => {
                  const assignee = db.employees.find((e) => e.id === task.assigneeId)
                  const overdue = task.status !== 'Done' && task.dueDate < today()
                  return (
                    <article
                      key={task.id}
                      draggable={canEdit(task)}
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => { setDragging(null); setOver(null) }}
                      onClick={() => canEdit(task) && setEditing(task)}
                      className={`group cursor-pointer rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        dragging === task.id ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${task.status === 'Done' ? 'text-stone-400 line-through' : 'text-stone-900'}`}>{task.title}</p>
                        <Badge tone={task.priority === 'High' ? 'red' : task.priority === 'Medium' ? 'amber' : 'stone'}>{task.priority}</Badge>
                      </div>
                      <Link
                        to={`/projects/${task.projectId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 block truncate text-xs text-stone-400 hover:text-brand-700"
                      >
                        {projectName(task.projectId)}{task.phase && ` · ${PHASE_LABELS[task.phase]}`}
                      </Link>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-stone-500">
                          <Avatar name={assignee?.name ?? '?'} size="sm" src={assignee?.photo} />
                          <span className="truncate">{assignee?.name.split(' ')[0]}</span>
                        </span>
                        <span className={`flex items-center gap-1 text-xs tabular-nums ${overdue ? 'font-semibold text-red-600' : task.dueDate === today() ? 'font-semibold text-amber-700' : 'text-stone-500'}`}>
                          <Icon name="clock" className="h-3.5 w-3.5" />
                          {task.dueDate === today() ? 'Today' : formatDate(task.dueDate).slice(0, 5)}
                        </span>
                      </div>
                    </article>
                  )
                })}
                {column.length === 0 && (
                  <p className="rounded-xl border-2 border-dashed border-stone-300/70 px-1 py-6 text-center text-xs text-stone-400">
                    {dragging ? 'Drop here' : 'Nothing here'}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <TaskFormModal
          task={'id' in editing ? editing : undefined}
          defaults={'id' in editing ? undefined : { status: editing.status }}
          onClose={() => setEditing(null)}
          onDelete={'id' in editing && can('Tasks', 'delete') ? () => { setDeleting(editing); setEditing(null) } : undefined}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this task?"
          message={<>“{deleting.title}” will be removed from {projectName(deleting.projectId) || 'its project'}.</>}
          onClose={() => setDeleting(null)}
          onConfirm={() => api.tasks.remove(deleting.id)}
        />
      )}
    </div>
  )
}

export { StatusBadge }
