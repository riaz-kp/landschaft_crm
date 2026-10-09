import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { today, pad2 } from '../../domain/format'
import { executionDashboardSeed } from '../../mock/seed'
import { PERIOD_LABELS, inRange, periodPhrase } from '../../domain/period'
import { allOccurrences } from '../../domain/amc'
import { PeriodSwitch, useDashboardPeriod } from '../../components/PeriodSwitch'
import {
  PageHeader, Section, StatTile, StatusBadge, SiteName, Table, EmptyState,
} from '../../components/ui'
import { Icon } from '../../components/Icon'

/**
 * The execution dashboard from §16 — Thameem and Jidhin's landing screen.
 * Counts are live off the store, so approving a report visibly moves them.
 */
export function ExecutionDashboard() {
  const db = useDb()
  const { user } = useSession()
  const date = today()

  const executionProjects = db.projects.filter(
    (p) => p.services.execution && p.status !== 'Completed',
  )
  const { period, range } = useDashboardPeriod()
  const when = periodPhrase(period)
  const todaysReports = db.reports.filter((r) => inRange(r.date, range))
  // Waiting for review is a standing queue, whatever the period.
  const submitted = db.reports.filter((r) => r.status === 'Submitted')
  const filed = todaysReports.filter((r) => r.status !== 'Draft')

  const activeSites = Math.max(executionProjects.length, executionDashboardSeed.activeSites)
  const workersToday = todaysReports.reduce(
    (sum, r) => sum + r.attendance.filter((a) => a.present).length, 0,
  )
  const delayed = db.projects.filter((p) => p.delayed && p.status !== 'Completed')
  const openIssues = db.issues.filter((i) => i.status === 'Open')
  const issuesRaised = db.issues.filter((i) => inRange(i.date, range))
  const completedTasks = db.tasks.filter((t) => t.status === 'Done' && inRange(t.dueDate, range))
  const amcVisits = allOccurrences(db.maintenance, date).filter((o) => inRange(o.date, range))

  const foremanName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader
        title={`Good day, ${user.name}`}
        subtitle="Execution Dashboard — sites, reports and the workforce."
        actions={<PeriodSwitch />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Active Sites" value={pad2(activeSites)} to="/execution" />
        <StatTile
          label={period === 'today' ? "Today's Reports" : 'Reports Filed'}
          value={period === 'today' ? `${pad2(filed.length)}/${pad2(activeSites)}` : pad2(filed.length)}
          sub={period === 'today' ? 'Filed against active sites' : `Daily reports ${when}`}
          to="/execution/reports"
        />
        <StatTile
          label="Pending Reports"
          value={pad2(submitted.length)}
          sub="Awaiting your review"
          tone={submitted.length > 0 ? 'amber' : 'green'}
          to="/execution/reports"
        />
        <StatTile label={period === 'today' ? 'Workers Today' : 'Worker-Days'} value={pad2(workersToday)} sub={period === 'today' ? undefined : `On site ${when}`} to="/employees/attendance" />
        <StatTile
          label="Delayed Projects"
          value={pad2(delayed.length)}
          tone={delayed.length > 0 ? 'red' : 'green'}
          to="/projects/execution"
        />
        <StatTile
          label="Issues Reported"
          value={pad2(openIssues.length)}
          sub={`${issuesRaised.length} raised ${when}`}
          tone={openIssues.length > 0 ? 'red' : 'green'}
          to="/execution/reports"
        />
        <StatTile label="Completed Tasks" value={pad2(completedTasks.length)} sub={`Due ${when}`} to="/tasks/board" />
        <StatTile
          label="AMC Visits"
          value={`${pad2(amcVisits.filter((o) => o.status === 'Done').length)}/${pad2(amcVisits.length)}`}
          sub={`Done of planned ${when}`}
          to="/amc/calendar"
        />
      </div>

      {submitted.length > 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900">
              {submitted.length === 1
                ? '1 daily report is waiting for review'
                : `${submitted.length} daily reports are waiting for review`}
            </p>
            <p className="mt-0.5 text-sm text-amber-800">
              Reports must be approved before they count toward project progress.
            </p>
          </div>
          <Link to="/execution/reports" className="btn-secondary shrink-0">Review</Link>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Section
          title={period === 'today' ? "Today's Site Reports" : `Site Reports — ${PERIOD_LABELS[period]}`}
          className="xl:col-span-2"
          actions={<Link to="/execution/reports" className="text-sm font-semibold text-brand-700">View all</Link>}
        >
          {todaysReports.length === 0 ? (
            <EmptyState title={`No reports filed ${when} yet.`} />
          ) : (
            <Table head={['Site', 'Foreman', 'Workers', 'Work', 'Status']}>
              {[...todaysReports].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map((report) => {
                const project = db.projects.find((p) => p.id === report.projectId)
                return (
                  <tr key={report.id} className="row-hover">
                    <td className="td font-medium text-stone-900">
                      <Link to={`/execution/reports/${report.id}`} className="hover:text-brand-700">
                        <SiteName name={report.siteLocation} />
                      </Link>
                      <span className="block text-xs text-stone-400">{project?.code}</span>
                    </td>
                    <td className="td">{foremanName(report.foremanId)}</td>
                    <td className="td tabular-nums">
                      {report.attendance.filter((a) => a.present).length}
                    </td>
                    <td className="td max-w-[16rem] truncate">
                      {report.workDone.find((w) => w.trim()) ?? '—'}
                    </td>
                    <td className="td"><StatusBadge status={report.status} /></td>
                  </tr>
                )
              })}
            </Table>
          )}
        </Section>

        <Section title="Open Issues">
          {openIssues.length === 0 ? (
            <EmptyState title="No open issues." hint="Site reports are running clean." />
          ) : (
            <ul className="divide-y divide-stone-100">
              {openIssues.map((issue) => {
                const project = db.projects.find((p) => p.id === issue.projectId)
                return (
                  <li key={issue.id} className="px-5 py-3.5">
                    <p className="text-sm text-stone-800">{issue.text}</p>
                    <p className="mt-1 text-xs text-stone-400">
                      {project?.name} · raised by {foremanName(issue.raisedBy)}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}
