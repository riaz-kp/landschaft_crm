import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSort } from '../../components/SortControl'
import { computeProgress } from '../../domain/progress'
import { formatDate, today } from '../../domain/format'
import { MEP_LABELS, MEP_SERVICES, type Project } from '../../domain/types'
import { quotationApproved } from '../../domain/commercial'
import {
  PageHeader, Section, StatusBadge, SiteName, EmptyState, Badge, ProgressBar, Pills,
} from '../../components/ui'

/** Site-oriented view of every project carrying the execution module. */
export function ExecutionProjects() {
  const db = useDb()
  const [approval, setApproval] = useState<'all' | 'approved' | 'pending'>('all')
  const live = db.projects.filter((p) => p.services.execution && p.status !== 'Completed')
  const approved = (p: Project) => quotationApproved(p, db.quotations)
  const approvedCount = live.filter(approved).length
  const lastReport = (p: Project) => db.reports.filter((r) => r.projectId === p.id).reduce((m, r) => (r.date > m ? r.date : m), '')
  const { sort, control: sortControl } = useSort<Project>('execution-projects', [
    { key: 'name', label: 'Project', value: (p) => p.name },
    { key: 'site', label: 'Site', value: (p) => p.siteLocation },
    { key: 'due', label: 'Due date', value: (p) => p.expectedCompletion },
    { key: 'progress', label: 'Progress', value: (p) => computeProgress(p).execution?.overall, dir: 'desc' },
    { key: 'report', label: 'Last report', value: lastReport, dir: 'desc' },
    { key: 'issues', label: 'Open issues', value: (p) => db.issues.filter((i) => i.projectId === p.id && i.status === 'Open').length, dir: 'desc' },
  ])
  const projects = sort(approval === 'all' ? live : live.filter((p) => approved(p) === (approval === 'approved')))

  return (
    <div>
      <PageHeader
        title="Execution Projects"
        subtitle="Live sites, their phases and today's reporting status."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Pills<'all' | 'approved' | 'pending'>
          active={approval}
          onChange={setApproval}
          options={[
            { key: 'all', label: 'All live sites', count: live.length },
            { key: 'approved', label: 'Quotation approved', count: approvedCount },
            { key: 'pending', label: 'Quotation not approved yet', count: live.length - approvedCount },
          ]}
        />
        {sortControl}
      </div>

      {projects.length === 0 ? (
        <Section><EmptyState title={approval === 'all' ? 'No live execution projects.' : 'No live sites match this filter.'} /></Section>
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
                    <dd className="mt-0.5 text-stone-700">{foremen.join(', ') || <Link to={`/projects/${project.id}`} className="font-semibold text-amber-700 hover:text-amber-800">None yet — assign</Link>}</dd>
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
