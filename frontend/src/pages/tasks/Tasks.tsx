import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { formatDate, today } from '../../domain/format'
import type { Task, TaskStatus } from '../../domain/types'
import {
  PageHeader, Section, StatusBadge, Table, EmptyState, Badge, Avatar,
} from '../../components/ui'

const STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Review', 'Done']

function TaskTable({ tasks, showAssignee }: { tasks: Task[]; showAssignee?: boolean }) {
  const db = useDb()
  if (tasks.length === 0) return <EmptyState title="No tasks here." />

  return (
    <Table head={['Task', 'Project', ...(showAssignee ? ['Assignee'] : []), 'Due', 'Priority', 'Status']}>
      {tasks.map((task) => {
        const project = db.projects.find((p) => p.id === task.projectId)
        const overdue = task.status !== 'Done' && task.dueDate < today()
        return (
          <tr key={task.id} className="row-hover">
            <td className="td">
              <span className="font-medium text-stone-900">{task.title}</span>
              {task.fromReportId && (
                <span className="ml-2 text-xs text-stone-400">from daily report</span>
              )}
            </td>
            <td className="td">
              <Link to={`/projects/${task.projectId}`} className="hover:text-brand-700">
                {project?.name}
              </Link>
            </td>
            {showAssignee && (
              <td className="td">
                <span className="flex items-center gap-2">
                  <Avatar name={db.employees.find((e) => e.id === task.assigneeId)?.name ?? '?'} size="sm" />
                  {db.employees.find((e) => e.id === task.assigneeId)?.name ?? '—'}
                </span>
              </td>
            )}
            <td className="td tabular-nums">
              {formatDate(task.dueDate)}
              {overdue && <Badge tone="red">Overdue</Badge>}
            </td>
            <td className="td">
              <Badge tone={task.priority === 'High' ? 'red' : task.priority === 'Medium' ? 'amber' : 'stone'}>
                {task.priority}
              </Badge>
            </td>
            <td className="td">
              <select
                value={task.status}
                onChange={(e) => api.tasks.setStatus(task.id, e.target.value as TaskStatus)}
                className="input py-1 text-xs"
                aria-label={`Status for ${task.title}`}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </td>
          </tr>
        )
      })}
    </Table>
  )
}

export function MyTasks() {
  const db = useDb()
  const { user } = useSession()
  const tasks = db.tasks.filter((t) => t.assigneeId === user.id)

  return (
    <div>
      <PageHeader title="My Tasks" subtitle={`Assigned to ${user.name}.`} />
      <Section><TaskTable tasks={tasks} /></Section>
    </div>
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

  const tasks = db.tasks.filter((t) => teamIds.includes(t.assigneeId))

  return (
    <div>
      <PageHeader title="Team Tasks" subtitle="Everything assigned across your team." />
      <Section><TaskTable tasks={tasks} showAssignee /></Section>
    </div>
  )
}

export function TaskBoard() {
  const db = useDb()

  return (
    <div>
      <PageHeader title="Task Board" subtitle="Every open task by stage." />
      <div className="grid gap-4 lg:grid-cols-4">
        {STATUSES.map((status) => {
          const column = db.tasks.filter((t) => t.status === status)
          return (
            <div key={status} className="rounded-xl bg-stone-200/60 p-3">
              <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-bold text-stone-700">
                {status}
                <span className="rounded-md bg-white px-2 py-0.5 text-xs tabular-nums text-stone-500">
                  {column.length}
                </span>
              </h2>
              <div className="space-y-2">
                {column.map((task) => {
                  const project = db.projects.find((p) => p.id === task.projectId)
                  return (
                    <article key={task.id} className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                      <p className="text-sm font-medium text-stone-900">{task.title}</p>
                      <Link
                        to={`/projects/${task.projectId}`}
                        className="mt-1 block truncate text-xs text-stone-400 hover:text-brand-700"
                      >
                        {project?.name}
                      </Link>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <Avatar name={db.employees.find((e) => e.id === task.assigneeId)?.name ?? '?'} size="sm" />
                        <span className="text-xs tabular-nums text-stone-500">{formatDate(task.dueDate)}</span>
                      </div>
                    </article>
                  )
                })}
                {column.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-stone-400">Nothing here</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { StatusBadge }
