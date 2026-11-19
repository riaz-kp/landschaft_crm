import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { usePermissions } from '../../state/permissions'
import { addDays, formatDate, formatDateLong, today } from '../../domain/format'
import { PHASE_LABELS, TASK_STATUS_LABELS, type ID, type Task, type TaskStatus } from '../../domain/types'
import {
  PageHeader, Section, StatusBadge, Table, EmptyState, Badge, Avatar, RowActions, ConfirmDialog,
  SearchInput, StatTile, ProgressBar,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { SearchSelect } from '../../components/SearchSelect'
import { employeeOptions, projectOptions } from '../../components/pickerOptions'
import { TASK_PRIORITIES, TASK_STATUSES, TaskDoneModal, TaskDrawer, TaskFormModal, TaskReassignModal, taskProgress } from './TaskForm'
import { WeeklyTaskReportModal, type WeeklyTaskScope } from './WeeklyTaskReport'

// ---------------------------------------------------------------- time filter

export type Period = 'all' | 'today' | 'week' | 'month' | 'overdue' | 'custom'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'custom', label: 'Custom' },
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

// ---------------------------------------------------------------- sorting

export type SortKey = 'due' | 'priority' | 'project' | 'title' | 'status' | 'assignee'
export interface Sort { key: SortKey; dir: 'asc' | 'desc' }

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'due', label: 'Due date' },
  { key: 'priority', label: 'Priority' },
  { key: 'project', label: 'Project' },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
]

const DEFAULT_SORT: Sort = { key: 'due', dir: 'asc' }
const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 }
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

/**
 * Sorts a copy of the list. Ties fall back to the due date. Sorting by due
 * date keeps finished tasks at the bottom, as the list always has.
 */
function sortTasks(tasks: Task[], sort: Sort, name: { project: (id: string) => string; person: (id: string) => string }): Task[] {
  const byDue = (a: Task, b: Task) => a.dueDate.localeCompare(b.dueDate)
  const compare: Record<SortKey, (a: Task, b: Task) => number> = {
    due: byDue,
    priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
    project: (a, b) => collator.compare(name.project(a.projectId), name.project(b.projectId)),
    title: (a, b) => collator.compare(a.title, b.title),
    status: (a, b) => TASK_STATUSES.indexOf(a.status) - TASK_STATUSES.indexOf(b.status),
    assignee: (a, b) => collator.compare(name.person(a.assigneeId), name.person(b.assigneeId)),
  }
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...tasks].sort((a, b) => {
    if (sort.key === 'due' && (a.status === 'Done') !== (b.status === 'Done')) return a.status === 'Done' ? 1 : -1
    return sign * compare[sort.key](a, b) || byDue(a, b)
  })
}

/** Sort picker with an ascending / descending toggle. */
function SortControl({ sort, setSort, keys }: { sort: Sort; setSort: (s: Sort) => void; keys: SortKey[] }) {
  return (
    <div className="flex min-w-0 gap-1">
      <label className="relative min-w-0 flex-1">
        <Icon name="sort" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <select
          className="input py-1.5 pl-8 sm:w-40"
          value={sort.key}
          onChange={(e) => setSort({ key: e.target.value as SortKey, dir: sort.dir })}
          aria-label="Sort by"
        >
          {SORTS.filter((s) => keys.includes(s.key)).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </label>
      <button
        type="button"
        onClick={() => setSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
        className="btn-secondary shrink-0 px-2.5 py-1.5"
        title={sort.dir === 'asc' ? 'Ascending — click for descending' : 'Descending — click for ascending'}
        aria-label={sort.dir === 'asc' ? 'Sorted ascending' : 'Sorted descending'}
      >
        <Icon name={sort.dir === 'asc' ? 'arrowUp' : 'arrowDown'} className="h-4 w-4" />
      </button>
    </div>
  )
}

/** A table heading that sorts the list by its column. */
function SortHeader({ label, k, sort, setSort }: { label: string; k: SortKey; sort: Sort; setSort: (s: Sort) => void }) {
  const on = sort.key === k
  return (
    <button
      type="button"
      onClick={() => setSort({ key: k, dir: on && sort.dir === 'asc' ? 'desc' : 'asc' })}
      className={`-mx-1 inline-flex items-center gap-1 rounded px-1 uppercase tracking-wider hover:text-stone-800 ${on ? 'text-brand-700' : ''}`}
    >
      {label}
      {on && <Icon name={sort.dir === 'asc' ? 'arrowUp' : 'arrowDown'} className="h-3 w-3" />}
    </button>
  )
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

/** What the weekly report covers from a task page: its scope and filters, ignoring the date window and search. */
function reportScope(
  tasks: Task[], f: Filters, label: string, name: { project: (id: string) => string; person: (id: string) => string }, people?: ID[],
): WeeklyTaskScope {
  return {
    tasks: applyFilters(tasks, { ...f, period: 'all', query: '' }, name.project),
    label: [label, f.projectId && name.project(f.projectId), f.assigneeId && name.person(f.assigneeId), f.priority && `${f.priority} priority`]
      .filter(Boolean).join(' · '),
    people: f.assigneeId ? [f.assigneeId] : people,
    projectId: f.projectId || undefined,
  }
}

/** Under a finished task's title: its done note. */
function DoneNote({ task }: { task: Task }) {
  if (task.status !== 'Done' || !task.doneNote) return null
  return (
    <span className="mt-1 flex items-start gap-1 text-xs text-stone-500">
      <Icon name="check" className="mt-px h-3 w-3 shrink-0 text-brand-600" />
      <span className="line-clamp-2">{task.doneNote}</span>
    </span>
  )
}

const WeeklyButton = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="btn-secondary" title="Download a week of tasks as an Excel workbook">
    <Icon name="upload" className="h-4 w-4 rotate-180" /> Weekly report
  </button>
)

// ---------------------------------------------------------------- list / board

export type TaskView = 'list' | 'board'

const VIEW_KEY = 'landschaft-tasks-view'
const VIEWS: { key: TaskView; label: string; icon: string }[] = [
  { key: 'list', label: 'List', icon: 'list' },
  { key: 'board', label: 'Board', icon: 'board' },
]

function storedView(): TaskView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list'
  } catch {
    return 'list'
  }
}

/** The task pages' list or board choice; remembered between visits in this browser. */
function useTaskView(): [TaskView, (v: TaskView) => void] {
  const [view, setViewState] = useState<TaskView>(storedView)
  const setView = (v: TaskView) => {
    setViewState(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* private mode */ }
  }
  return [view, setView]
}

function ViewSwitch({ view, setView }: { view: TaskView; setView: (v: TaskView) => void }) {
  return (
    <div className="flex shrink-0 gap-1 rounded-xl bg-stone-100 p-1" role="group" aria-label="View">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => setView(v.key)}
          aria-pressed={view === v.key}
          title={`${v.label} view`}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition sm:text-sm ${
            view === v.key ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Icon name={v.icon} className="h-4 w-4" /> {v.label}
        </button>
      ))}
    </div>
  )
}

function FilterBar({
  filters, setFilters, sort, setSort, sortKeys, showAssignee, total, shown, view, setView,
}: {
  filters: Filters; setFilters: (f: Filters) => void
  sort: Sort; setSort: (s: Sort) => void; sortKeys: SortKey[]
  showAssignee?: boolean; total: number; shown: number
  /** Given on the pages that offer both a list and a board. */
  view?: TaskView; setView?: (v: TaskView) => void
}) {
  const db = useDb()
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch })
  const range = periodRange(filters)
  const active = filters.period !== 'all' || filters.projectId || filters.assigneeId || filters.priority || filters.query

  return (
    <div className="card mb-5 space-y-3 p-3 sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        {/* Three to a row on a phone rather than a strip that scrolls sideways. */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 sm:flex">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => set({ period: p.key })}
              className={`rounded-lg px-2 py-1.5 text-[13px] font-medium transition sm:shrink-0 sm:px-3 sm:text-sm ${
                filters.period === p.key ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={filters.query} onChange={(query) => set({ query })} placeholder="Search tasks or projects…" className="min-w-0 flex-1 xl:w-72 xl:flex-none" />
          {view && setView && <ViewSwitch view={view} setView={setView} />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {filters.period === 'custom' && (
          <div className="col-span-2 flex items-center gap-2">
            <input type="date" className="input min-w-0 flex-1 py-1.5 sm:w-auto sm:flex-none" value={filters.from} onChange={(e) => set({ from: e.target.value })} aria-label="From" />
            <span className="text-sm text-stone-400">to</span>
            <input type="date" className="input min-w-0 flex-1 py-1.5 sm:w-auto sm:flex-none" value={filters.to} onChange={(e) => set({ to: e.target.value })} aria-label="To" />
          </div>
        )}
        <div className="col-span-2 sm:w-60">
          <SearchSelect
            size="sm"
            value={filters.projectId}
            onChange={(projectId) => set({ projectId })}
            options={projectOptions(db)}
            emptyOption="All projects"
            searchPlaceholder="Search projects"
            ariaLabel="Project"
            title="Filter by project"
          />
        </div>
        {showAssignee && (
          <div className="sm:w-48">
            <SearchSelect
              size="sm"
              value={filters.assigneeId}
              onChange={(assigneeId) => set({ assigneeId })}
              options={employeeOptions(db.employees.filter((e) => e.role !== 'super_admin'))}
              emptyOption="Everyone"
              searchPlaceholder="Search people"
              ariaLabel="Assignee"
              title="Filter by assignee"
            />
          </div>
        )}
        <select className={`input py-1.5 sm:w-auto ${showAssignee ? '' : 'col-span-2'}`} value={filters.priority} onChange={(e) => set({ priority: e.target.value })} aria-label="Priority">
          <option value="">Any priority</option>
          {TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <div className="col-span-2 sm:col-span-1">
          <SortControl sort={sort} setSort={setSort} keys={sortKeys} />
        </div>
        <span className="col-span-2 text-xs text-stone-500 sm:ml-auto">
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

// ---------------------------------------------------------------- board

const COLUMN_TONE: Record<TaskStatus, string> = {
  'To Do': 'bg-stone-400',
  'In Progress': 'bg-amber-500',
  Review: 'bg-clay-500',
  Done: 'bg-brand-500',
}

/**
 * The tasks as four columns: To begin, In progress, Awaiting approval and
 * Completed. A card is dragged between columns with a mouse; on a phone, where
 * dragging is not available, each card carries a "move to" picker instead.
 */
function Board({
  tasks, canEdit, canCreate, onOpen, onAdd, onMove,
}: {
  tasks: Task[]
  canEdit: (t: Task) => boolean
  canCreate: boolean
  onOpen: (t: Task) => void
  onAdd: (status: TaskStatus) => void
  onMove: (t: Task, status: TaskStatus) => void
}) {
  const db = useDb()
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<TaskStatus | null>(null)
  // On a phone the board shows one column at a time instead of scrolling sideways.
  const [column, setColumn] = useState<TaskStatus>('To Do')
  const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? ''

  return (
    <>
      {/* Phone: pick a column. Tablet: two by two. Desktop: all four side by side. */}
      <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-stone-200/60 p-1 md:hidden">
        {TASK_STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => setColumn(status)}
            aria-pressed={column === status}
            className={`flex flex-col items-center justify-between gap-0.5 rounded-lg px-1 py-1.5 text-center text-[11px] font-semibold leading-tight transition ${
              column === status ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${COLUMN_TONE[status]}`} />
            <span>{TASK_STATUS_LABELS[status]}</span>
            <span className="tabular-nums text-stone-400">{tasks.filter((t) => t.status === status).length}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {TASK_STATUSES.map((status) => {
          const cards = tasks.filter((t) => t.status === status)
          const label = TASK_STATUS_LABELS[status]
          return (
            <div
              key={status}
              onDragOver={(e) => { e.preventDefault(); setOver(status) }}
              onDragLeave={() => setOver((o) => (o === status ? null : o))}
              onDrop={(e) => {
                e.preventDefault()
                const task = tasks.find((t) => t.id === dragging)
                if (task) onMove(task, status)
                setDragging(null)
                setOver(null)
              }}
              className={`${column === status ? '' : 'hidden md:block'} min-w-0 rounded-2xl p-3 transition ${
                over === status ? 'bg-brand-100/70 ring-2 ring-brand-400' : 'bg-stone-200/50'
              }`}
            >
              <h2 className="mb-3 flex items-center justify-between gap-2 px-1 text-sm font-bold text-stone-700">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${COLUMN_TONE[status]}`} /> <span className="truncate">{label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs tabular-nums text-stone-500">{cards.length}</span>
                  {canCreate && (
                    <button onClick={() => onAdd(status)} className="btn-icon h-6 w-6" title={`Add a task to ${label}`} aria-label={`Add a task to ${label}`}>
                      <Icon name="plus" className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              </h2>
              <div className="min-h-24 space-y-2">
                {cards.map((task) => {
                  const assignee = db.employees.find((e) => e.id === task.assigneeId)
                  const overdue = task.status !== 'Done' && task.dueDate < today()
                  const editable = canEdit(task)
                  return (
                    <article
                      key={task.id}
                      draggable={editable}
                      onDragStart={(e) => {
                        // Firefox only starts a drag once it has been given something to carry.
                        e.dataTransfer.setData('text/plain', task.id)
                        e.dataTransfer.effectAllowed = 'move'
                        setDragging(task.id)
                      }}
                      onDragEnd={() => { setDragging(null); setOver(null) }}
                      onClick={() => onOpen(task)}
                      className={`group cursor-pointer rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        dragging === task.id ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${task.status === 'Done' ? 'text-stone-400 line-through' : 'text-stone-900'}`}>{task.title}</p>
                        <Badge tone={task.priority === 'High' ? 'red' : task.priority === 'Medium' ? 'amber' : 'stone'}>{task.priority}</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-stone-400">
                        {projectName(task.projectId)}{task.phase && ` · ${PHASE_LABELS[task.phase]}`}
                      </p>
                      <DoneNote task={task} />
                      {task.status !== 'Done' && taskProgress(task) > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="min-w-0 flex-1"><ProgressBar value={taskProgress(task)} size="sm" /></div>
                          <span className="text-[11px] font-semibold tabular-nums text-stone-500">{taskProgress(task)}%</span>
                        </div>
                      )}
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-xs text-stone-500">
                          <Avatar name={assignee?.name ?? '?'} size="sm" src={assignee?.photo} />
                          <span className="truncate">{assignee?.name.split(' ')[0] ?? 'Unassigned'}</span>
                        </span>
                        <span className={`flex shrink-0 items-center gap-1 text-xs tabular-nums ${overdue ? 'font-semibold text-red-600' : task.dueDate === today() ? 'font-semibold text-amber-700' : 'text-stone-500'}`}>
                          <Icon name="clock" className="h-3.5 w-3.5" />
                          {task.dueDate === today() ? 'Today' : formatDate(task.dueDate).slice(0, 5)}
                        </span>
                      </div>
                      {editable && (
                        <select
                          value={task.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => onMove(task, e.target.value as TaskStatus)}
                          className="input mt-2.5 py-1 text-xs md:hidden"
                          aria-label={`Move ${task.title} to`}
                        >
                          {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
                        </select>
                      )}
                    </article>
                  )
                })}
                {cards.length === 0 && (
                  <p className="rounded-xl border-2 border-dashed border-stone-300/70 px-1 py-6 text-center text-xs text-stone-400">
                    {dragging ? 'Drop here' : 'Nothing here'}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- shared task page

/** Opens the task named in `?open=` (the header search links here). */
function useOpenFromUrl(setViewing: (id: string) => void) {
  const db = useDb()
  const [params, setParams] = useSearchParams()
  const open = params.get('open')
  useEffect(() => {
    if (!open) return
    const task = db.tasks.find((t) => t.id === open)
    if (task) setViewing(task.id)
    setParams({}, { replace: true })
  }, [open])
}

function TaskList({
  title, subtitle, scope, showAssignee, people, reportLabel = title, boardOnly,
}: {
  title: string; subtitle: string; scope: (t: Task) => boolean; showAssignee?: boolean
  /** Whose tasks the page shows, for the weekly report's hand-overs; unset means everyone. */
  people?: ID[]
  /** What the weekly report calls this set of tasks; the page title unless given. */
  reportLabel?: string
  /** The Task Board page: always the board, with no list to switch to. */
  boardOnly?: boolean
}) {
  const db = useDb()
  const { user } = useSession()
  const { can } = usePermissions()
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT)
  const [chosenView, setView] = useTaskView()
  const view: TaskView = boardOnly ? 'board' : chosenView
  // A task being edited, or the column a new one was started from.
  const [editing, setEditing] = useState<Task | { status: TaskStatus } | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [finishing, setFinishing] = useState<Task | null>(null)
  const [reassigning, setReassigning] = useState<Task | null>(null)
  const [weekly, setWeekly] = useState(false)
  // The task open in the reading panel.
  const [viewing, setViewing] = useState<string | null>(null)
  useOpenFromUrl(setViewing)

  const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? ''
  const personName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? ''
  const scoped = db.tasks.filter(scope)
  // The board's columns are the statuses, so sorting by status does nothing there.
  const sortKeys: SortKey[] = [
    'due', 'priority', 'project', 'title', ...(view === 'list' ? ['status' as const] : []), ...(showAssignee ? ['assignee' as const] : []),
  ]
  const activeSort = sortKeys.includes(sort.key) ? sort : DEFAULT_SORT
  const tasks = sortTasks(applyFilters(scoped, filters, projectName), activeSort, { project: projectName, person: personName })
  const th = (label: string, k: SortKey) => <SortHeader label={label} k={k} sort={activeSort} setSort={setSort} />

  const open = scoped.filter((t) => t.status !== 'Done')
  const overdue = open.filter((t) => t.dueDate < today())
  const dueToday = open.filter((t) => t.dueDate === today())
  const [ws, we] = weekRange(today())
  const thisWeek = open.filter((t) => t.dueDate >= ws && t.dueDate <= we)

  const canEdit = (t: Task) => can('Tasks', 'edit') || t.assigneeId === user.id
  /** Completing a task asks for its done note first. */
  const move = (task: Task, status: TaskStatus) => {
    if (status === task.status) return
    if (status === 'Done') setFinishing(task)
    else api.tasks.setStatus(task.id, status, user.id)
  }

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={<>
          <WeeklyButton onClick={() => setWeekly(true)} />
          {can('Tasks', 'create') && (
            <button onClick={() => setEditing({ status: 'To Do' })} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> New task</button>
          )}
        </>}
      />

      {!boardOnly && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Open" value={open.length} icon="check" />
          <StatTile label="Due Today" value={dueToday.length} tone={dueToday.length ? 'amber' : 'stone'} icon="clock" />
          <StatTile label="Due This Week" value={thisWeek.length} tone="blue" icon="calendar" />
          <StatTile label="Overdue" value={overdue.length} tone={overdue.length ? 'red' : 'green'} icon="alert" />
        </div>
      )}

      <FilterBar
        filters={filters} setFilters={setFilters} sort={activeSort} setSort={setSort} sortKeys={sortKeys}
        showAssignee={showAssignee} total={scoped.length} shown={tasks.length}
        view={boardOnly ? undefined : view} setView={boardOnly ? undefined : setView}
      />

      {view === 'board' ? (
        <Board
          tasks={tasks}
          canEdit={canEdit}
          canCreate={can('Tasks', 'create')}
          onOpen={(t) => setViewing(t.id)}
          onAdd={(status) => setEditing({ status })}
          onMove={move}
        />
      ) : (
        <Section>
          {tasks.length === 0 ? (
            <EmptyState title="No tasks match these filters." icon="check" />
          ) : (
            <Table
              head={[
                th('Task', 'title'), th('Project', 'project'), ...(showAssignee ? [th('Assignee', 'assignee')] : []),
                th('Due', 'due'), th('Priority', 'priority'), th('Status', 'status'), '',
              ]}
            >
              {tasks.map((task) => {
                const overdueTask = task.status !== 'Done' && task.dueDate < today()
                const assignee = db.employees.find((e) => e.id === task.assigneeId)
                return (
                  <tr key={task.id} className="row-hover">
                    <td className="td">
                      <button onClick={() => setViewing(task.id)} className="text-left">
                        <span className={`font-medium ${task.status === 'Done' ? 'text-stone-400 line-through' : 'text-stone-900'} hover:text-brand-700`}>{task.title}</span>
                      </button>
                      <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-stone-400">
                        {task.phase && <span>{PHASE_LABELS[task.phase]}</span>}
                        {task.fromReportId && <span>from daily report</span>}
                      </span>
                      <DoneNote task={task} />
                      {task.status !== 'Done' && taskProgress(task) > 0 && (
                        <span className="mt-1.5 flex w-40 items-center gap-2">
                          <span className="min-w-0 flex-1"><ProgressBar value={taskProgress(task)} size="sm" /></span>
                          <span className="text-[11px] font-semibold tabular-nums text-stone-500">{taskProgress(task)}%</span>
                        </span>
                      )}
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
                        onChange={(e) => move(task, e.target.value as TaskStatus)}
                        className="input w-40 py-1 text-xs"
                        aria-label={`Status for ${task.title}`}
                      >
                        {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
                      </select>
                    </td>
                    <td className="td">
                      <RowActions
                        extra={canEdit(task) && task.status !== 'Done' && (
                          <button type="button" onClick={() => setReassigning(task)} className="btn-icon" title="Reassign" aria-label={`Reassign ${task.title}`}>
                            <Icon name="repeat" className="h-4 w-4" />
                          </button>
                        )}
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
      )}

      {editing && (
        <TaskFormModal
          task={'id' in editing ? editing : undefined}
          defaults={'id' in editing ? undefined : { status: editing.status, assigneeId: showAssignee ? undefined : user.id }}
          onClose={() => setEditing(null)}
          onDelete={'id' in editing && can('Tasks', 'delete') ? () => { setDeleting(editing); setEditing(null) } : undefined}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this task?"
          message={<>“{deleting.title}” will be removed from {projectName(deleting.projectId) || 'its project'}.</>}
          onClose={() => setDeleting(null)}
          onConfirm={() => api.tasks.remove(deleting.id, user.id)}
        />
      )}
      {finishing && <TaskDoneModal task={finishing} onClose={() => setFinishing(null)} />}
      {reassigning && <TaskReassignModal task={reassigning} onClose={() => setReassigning(null)} />}
      {viewing && (() => {
        const task = db.tasks.find((t) => t.id === viewing)
        return task && (
          <TaskDrawer
            taskId={viewing}
            canEdit={canEdit(task)}
            onClose={() => setViewing(null)}
            onDelete={can('Tasks', 'delete') ? setDeleting : undefined}
          />
        )
      })()}
      {weekly && (
        <WeeklyTaskReportModal
          scope={reportScope(scoped, filters, reportLabel, { project: projectName, person: personName }, people)}
          onClose={() => setWeekly(false)}
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
      people={[user.id]}
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
      people={teamIds}
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

export function TaskBoard() {
  return (
    <TaskList
      title="Task Board"
      subtitle="Every task by stage. Drag a card to move it; click it to open. Dropping a card on Completed asks for its done note."
      scope={() => true}
      showAssignee
      reportLabel="All tasks"
      boardOnly
    />
  )
}

export { StatusBadge }
