import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { formatDate, formatDuration, minutesBetween, pad2 } from '../../domain/format'
import type { ReportStatus } from '../../domain/types'
import {
  PageHeader, Section, StatusBadge, SiteName, Table, EmptyState, StatTile, Badge,
} from '../../components/ui'

const FILTERS: (ReportStatus | 'All')[] = ['All', 'Submitted', 'Approved', 'Sent Back', 'Draft']

/** The Execution PM's review queue. */
export function DailyWorkReports() {
  const db = useDb()
  const [filter, setFilter] = useState<ReportStatus | 'All'>('All')

  const reports = [...db.reports]
    .filter((r) => filter === 'All' || r.status === filter)
    .sort((a, b) => b.date.localeCompare(a.date) || a.siteLocation.localeCompare(b.siteLocation))

  const submitted = db.reports.filter((r) => r.status === 'Submitted')
  const openIssues = db.issues.filter((i) => i.status === 'Open')
  const foremanName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader
        title="Daily Work Reports"
        subtitle="Reports filed by site foremen. Approve before they count toward progress."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Awaiting Review" value={pad2(submitted.length)}
          tone={submitted.length ? 'amber' : 'green'}
        />
        <StatTile
          label="Approved" value={pad2(db.reports.filter((r) => r.status === 'Approved').length)}
          tone="green"
        />
        <StatTile
          label="Sent Back" value={pad2(db.reports.filter((r) => r.status === 'Sent Back').length)}
          tone={db.reports.some((r) => r.status === 'Sent Back') ? 'red' : 'stone'}
        />
        <StatTile
          label="Open Issues" value={pad2(openIssues.length)}
          tone={openIssues.length ? 'red' : 'green'}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((status) => {
          const count = status === 'All'
            ? db.reports.length
            : db.reports.filter((r) => r.status === status).length
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-brand-600 text-white'
                  : 'border border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {status} <span className="tabular-nums opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      <Section>
        {reports.length === 0 ? (
          <EmptyState title="No reports match this filter." />
        ) : (
          <Table head={['Date', 'Site', 'Foreman', 'Workers', 'Hours', 'Work', 'Issues', 'Status', '']}>
            {reports.map((report) => {
              const project = db.projects.find((p) => p.id === report.projectId)
              const issueCount = report.issues.filter(
                (i) => i.trim() && i.trim().toLowerCase() !== 'nothing',
              ).length
              return (
                <tr key={report.id} className="row-hover">
                  <td className="td tabular-nums font-medium text-stone-900">{formatDate(report.date)}</td>
                  <td className="td">
                    <SiteName name={report.siteLocation} />
                    <span className="block text-xs text-stone-400">{project?.code}</span>
                  </td>
                  <td className="td">{foremanName(report.foremanId)}</td>
                  <td className="td tabular-nums">{report.attendance.filter((a) => a.present).length}</td>
                  <td className="td tabular-nums">
                    {formatDuration(minutesBetween(report.startTime, report.endTime))}
                    {report.otHours > 0 && (
                      <span className="ml-1 text-xs text-clay-700">+{report.otHours}h OT</span>
                    )}
                  </td>
                  <td className="td max-w-[14rem] truncate">
                    {report.workDone.find((w) => w.trim()) ?? '—'}
                  </td>
                  <td className="td">
                    {issueCount > 0 ? <Badge tone="red">{issueCount}</Badge> : <span className="text-stone-300">—</span>}
                  </td>
                  <td className="td"><StatusBadge status={report.status} /></td>
                  <td className="td">
                    <Link to={`/execution/reports/${report.id}`} className="text-sm font-semibold text-brand-700">
                      {report.status === 'Submitted' ? 'Review' : 'Open'}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Section>
    </div>
  )
}
