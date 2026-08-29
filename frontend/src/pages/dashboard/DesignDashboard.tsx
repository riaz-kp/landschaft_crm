import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { computeProgress } from '../../domain/progress'
import { DESIGN_PHASES, PHASE_LABELS } from '../../domain/types'
import { formatDate, pad2 } from '../../domain/format'
import {
  PageHeader, Section, StatTile, StatusBadge, Table, EmptyState, ProgressBar,
} from '../../components/ui'

/** Design Director / PM / team member view. */
export function DesignDashboard() {
  const db = useDb()
  const { user, roleKey } = useSession()

  const designProjects = db.projects.filter((p) => p.services.design && p.status !== 'Completed')
  // A PM or team member only sees what is actually theirs.
  const mine = roleKey === 'design_director'
    ? designProjects
    : designProjects.filter(
        (p) => p.projectManagerId === user.id ||
          db.tasks.some((t) => t.projectId === p.id && t.assigneeId === user.id),
      )

  const myTasks = db.tasks.filter(
    (t) => t.assigneeId === user.id && t.status !== 'Done',
  )
  const inReview = db.tasks.filter(
    (t) => t.status === 'Review' && mine.some((p) => p.id === t.projectId),
  )
  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'

  // How far each of the four design phases has progressed across the portfolio.
  const phaseAverages = DESIGN_PHASES.map((key) => {
    const values = mine.filter((p) => p.design[key].enabled).map((p) => p.design[key].progress)
    return {
      key,
      label: PHASE_LABELS[key],
      average: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
      count: values.length,
    }
  })

  return (
    <div>
      <PageHeader
        title={`Good day, ${user.name}`}
        subtitle="Design Dashboard — concept through to BOQ."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Design Projects" value={pad2(mine.length)} to="/projects/design" />
        <StatTile label="My Open Tasks" value={pad2(myTasks.length)} to="/tasks/mine" />
        <StatTile
          label="In Review" value={pad2(inReview.length)}
          tone={inReview.length ? 'amber' : 'green'} to="/tasks/board"
        />
        <StatTile
          label="Due This Week"
          value={pad2(myTasks.filter((t) => {
            const days = (new Date(t.dueDate).getTime() - Date.now()) / 86400000
            return days <= 7
          }).length)}
          tone="amber" to="/tasks/mine"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Section title="Design Projects" className="xl:col-span-2">
          {mine.length === 0 ? (
            <EmptyState title="No design projects assigned to you." />
          ) : (
            <Table head={['Project', 'Client', 'Design Progress', 'Status']}>
              {mine.map((project) => {
                const progress = computeProgress(project)
                return (
                  <tr key={project.id} className="row-hover">
                    <td className="td">
                      <Link to={`/projects/${project.id}`} className="font-medium text-stone-900 hover:text-brand-700">
                        {project.name}
                      </Link>
                      <span className="block text-xs text-stone-400">{project.code}</span>
                    </td>
                    <td className="td">{clientName(project.clientId)}</td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className="w-24"><ProgressBar value={progress.design?.overall ?? 0} size="sm" /></div>
                        <span className="w-9 text-right text-xs font-semibold tabular-nums">
                          {progress.design?.overall ?? 0}%
                        </span>
                      </div>
                    </td>
                    <td className="td"><StatusBadge status={project.status} /></td>
                  </tr>
                )
              })}
            </Table>
          )}
        </Section>

        <div className="space-y-6">
          <Section title="Phase Averages" description="Across your active design projects">
            <div className="space-y-3 px-5 py-4">
              {phaseAverages.map((phase) => (
                <div key={phase.key}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-sm text-stone-600">{phase.label}</span>
                    <span className="text-sm font-semibold tabular-nums text-stone-800">{phase.average}%</span>
                  </div>
                  <ProgressBar value={phase.average} size="sm" />
                  <p className="mt-0.5 text-xs text-stone-400">{phase.count} project(s)</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="My Next Tasks">
            {myTasks.length === 0 ? (
              <EmptyState title="Nothing outstanding." />
            ) : (
              <ul className="divide-y divide-stone-100">
                {myTasks.slice(0, 5).map((task) => (
                  <li key={task.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-stone-800">{task.title}</p>
                    <p className="mt-0.5 text-xs text-stone-400">Due {formatDate(task.dueDate)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}
