import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { computeProgress } from '../../domain/progress'
import { formatDate, formatTime, pad2, today } from '../../domain/format'
import { PHASE_LABELS, type Employee } from '../../domain/types'
import {
  Section, Table, EmptyState, StatTile, StatusBadge, SiteName, ProgressBar, Badge,
} from '../../components/ui'

/** Everything an employee has been given or has done, across the system. */
export function EmployeeWorks({ employee }: { employee: Employee }) {
  const db = useDb()

  const tasks = db.tasks
    .filter((t) => t.assigneeId === employee.id)
    .sort((a, b) => (a.status === 'Done') === (b.status === 'Done')
      ? a.dueDate.localeCompare(b.dueDate)
      : a.status === 'Done' ? 1 : -1)
  const openTasks = tasks.filter((t) => t.status !== 'Done')
  const managed = db.projects.filter((p) => p.projectManagerId === employee.id)
  const filed = db.reports.filter((r) => r.foremanId === employee.id && r.status !== 'Draft')
  const reviewed = db.reports.filter((r) => r.reviewedBy === employee.id)
  const visits = db.siteVisits.filter((v) => v.assignedTo === employee.id)
  const booked = db.consultations.filter((c) => c.bookedBy === employee.id)

  const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? '—'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Open Tasks" value={pad2(openTasks.length)} tone={openTasks.length ? 'amber' : 'green'} />
        <StatTile label="Tasks Done" value={pad2(tasks.length - openTasks.length)} tone="green" />
        <StatTile label="Projects Managed" value={pad2(managed.length)} />
        <StatTile
          label={employee.role === 'foreman' ? 'Reports Filed' : 'Reports Reviewed'}
          value={pad2(employee.role === 'foreman' ? filed.length : reviewed.length)}
        />
      </div>

      <Section title="Tasks" description={`${openTasks.length} open · ${tasks.length - openTasks.length} done`}>
        {tasks.length === 0 ? (
          <EmptyState title="No tasks assigned." />
        ) : (
          <Table head={['Task', 'Project', 'Phase', 'Due', 'Priority', 'Status']}>
            {tasks.map((task) => {
              const overdue = task.status !== 'Done' && task.dueDate < today()
              return (
                <tr key={task.id} className="row-hover">
                  <td className="td font-medium text-stone-900">{task.title}</td>
                  <td className="td">
                    <Link to={`/projects/${task.projectId}`} className="hover:text-brand-700">{projectName(task.projectId)}</Link>
                  </td>
                  <td className="td">{task.phase ? PHASE_LABELS[task.phase] : '—'}</td>
                  <td className={`td tabular-nums ${overdue ? 'font-semibold text-red-700' : ''}`}>{formatDate(task.dueDate)}</td>
                  <td className="td">{task.priority}</td>
                  <td className="td"><StatusBadge status={task.status} /></td>
                </tr>
              )
            })}
          </Table>
        )}
      </Section>

      {managed.length > 0 && (
        <Section title="Projects Managed">
          <Table head={['Project', 'Site', 'Progress', 'Status']}>
            {managed.map((project) => {
              const progress = computeProgress(project).overall
              return (
                <tr key={project.id} className="row-hover">
                  <td className="td">
                    <Link to={`/projects/${project.id}`} className="font-medium text-stone-900 hover:text-brand-700">{project.name}</Link>
                    <span className="block text-xs text-stone-400">{project.code}</span>
                  </td>
                  <td className="td"><SiteName name={project.siteLocation} /></td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-24"><ProgressBar value={progress} size="sm" /></div>
                      <span className="text-xs font-semibold tabular-nums">{progress}%</span>
                    </div>
                  </td>
                  <td className="td">
                    {project.delayed && project.status !== 'Completed'
                      ? <Badge tone="red">Delayed</Badge>
                      : <StatusBadge status={project.status} />}
                  </td>
                </tr>
              )
            })}
          </Table>
        </Section>
      )}

      {(filed.length > 0 || reviewed.length > 0) && (
        <Section title={filed.length ? 'Daily Reports Filed' : 'Daily Reports Reviewed'}>
          <Table head={['Date', 'Site', 'Workers', 'Work Done', 'Status', '']}>
            {[...(filed.length ? filed : reviewed)].sort((a, b) => b.date.localeCompare(a.date)).map((report) => (
              <tr key={report.id} className="row-hover">
                <td className="td tabular-nums font-medium text-stone-900">{formatDate(report.date)}</td>
                <td className="td"><SiteName name={report.siteLocation} /></td>
                <td className="td tabular-nums">{report.attendance.filter((a) => a.present).length}</td>
                <td className="td max-w-xs truncate">{report.workDone.filter((w) => w.trim()).join('; ') || '—'}</td>
                <td className="td"><StatusBadge status={report.status} /></td>
                <td className="td">
                  <Link to={`/execution/reports/${report.id}`} className="text-sm font-semibold text-brand-700">Open</Link>
                </td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {visits.length > 0 && (
        <Section title="Site Visits">
          <Table head={['Date', 'Location', 'Notes', 'Status']}>
            {visits.map((visit) => (
              <tr key={visit.id} className="row-hover">
                <td className="td tabular-nums font-medium text-stone-900">{formatDate(visit.date)}</td>
                <td className="td">{visit.location}</td>
                <td className="td max-w-sm">{visit.notes}</td>
                <td className="td"><StatusBadge status={visit.status} /></td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {booked.length > 0 && (
        <Section title="CEO Consultations Booked">
          <Table head={['Date', 'Time', 'Purpose', 'Status']}>
            {booked.map((c) => (
              <tr key={c.id} className="row-hover">
                <td className="td tabular-nums font-medium text-stone-900">{formatDate(c.date)}</td>
                <td className="td tabular-nums">{formatTime(c.start)}</td>
                <td className="td">{c.purpose}</td>
                <td className="td"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
          </Table>
        </Section>
      )}
    </div>
  )
}
