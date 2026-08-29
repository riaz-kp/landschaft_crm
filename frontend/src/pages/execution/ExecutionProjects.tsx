import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { computeProgress } from '../../domain/progress'
import { formatDate, today } from '../../domain/format'
import { MEP_LABELS, MEP_SERVICES } from '../../domain/types'
import {
  PageHeader, Section, StatusBadge, SiteName, EmptyState, Badge, ProgressBar,
} from '../../components/ui'

/** Site-oriented view of every project carrying the execution module. */
export function ExecutionProjects() {
  const db = useDb()
  const projects = db.projects.filter((p) => p.services.execution && p.status !== 'Completed')

  return (
    <div>
      <PageHeader
        title="Execution Projects"
        subtitle="Live sites, their phases and today's reporting status."
      />

      {projects.length === 0 ? (
        <Section><EmptyState title="No live execution projects." /></Section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {projects.map((project) => {
            const progress = computeProgress(project)
            const foremen = db.siteAssignments
              .filter((a) => a.projectId === project.id)
              .map((a) => db.employees.find((e) => e.id === a.foremanId)?.name)
              .filter(Boolean)
            const todaysReport = db.reports.find(
              (r) => r.projectId === project.id && r.date === today(),
            )
            const openIssues = db.issues.filter(
              (i) => i.projectId === project.id && i.status === 'Open',
            )

            return (
              <article key={project.id} className="card-pad">
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to={`/projects/${project.id}`}
                      className="text-base font-semibold text-stone-900 hover:text-brand-700"
                    >
                      {project.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-stone-500">
                      <SiteName name={project.siteLocation} /> · {project.code}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge status={project.status} />
                    {project.delayed && <Badge tone="red">Delayed</Badge>}
                  </div>
                </header>

                <div className="mt-4 space-y-2">
                  {progress.execution?.phases.map((phase) => (
                    <div key={phase.key} className="flex items-center gap-3">
                      <span className={`w-24 shrink-0 text-xs ${phase.counted ? 'text-stone-600' : 'text-stone-400'}`}>
                        {phase.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <ProgressBar value={phase.progress} size="sm" tone={phase.counted ? 'green' : 'stone'} />
                      </div>
                      <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-stone-600">
                        {phase.progress}%
                      </span>
                    </div>
                  ))}
                </div>

                {project.execution.mep.enabled && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {MEP_SERVICES.filter((s) => project.execution.mep.services[s]).map((s) => (
                      <Badge key={s} tone="blue">{MEP_LABELS[s]}</Badge>
                    ))}
                  </div>
                )}

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-stone-100 pt-4 text-sm">
                  <div>
                    <dt className="label">Foreman</dt>
                    <dd className="mt-0.5 text-stone-700">{foremen.join(', ') || '—'}</dd>
                  </div>
                  <div>
                    <dt className="label">Due</dt>
                    <dd className="mt-0.5 tabular-nums text-stone-700">{formatDate(project.expectedCompletion)}</dd>
                  </div>
                  <div>
                    <dt className="label">Today's Report</dt>
                    <dd className="mt-0.5">
                      {todaysReport
                        ? <StatusBadge status={todaysReport.status} />
                        : <span className="text-stone-400">Not filed</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="label">Open Issues</dt>
                    <dd className="mt-0.5">
                      {openIssues.length ? <Badge tone="red">{openIssues.length}</Badge> : <span className="text-stone-400">None</span>}
                    </dd>
                  </div>
                </dl>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
