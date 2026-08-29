import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { formatDate, formatDuration, minutesBetween } from '../../domain/format'
import {
  PageHeader, Section, StatusBadge, SiteName, Table, EmptyState, StatTile,
} from '../../components/ui'

/** Work history, grouped by foreman rather than by site. */
export function WorkReports() {
  const db = useDb()
  const foremen = db.employees.filter((e) => e.role === 'foreman')

  return (
    <div>
      <PageHeader
        title="Work Reports"
        subtitle="Every daily report filed, grouped by the foreman who filed it."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Foremen" value={foremen.length} />
        <StatTile label="Reports Filed" value={db.reports.filter((r) => r.status !== 'Draft').length} />
        <StatTile
          label="Approved" value={db.reports.filter((r) => r.status === 'Approved').length} tone="green"
        />
        <StatTile
          label="Total Worker-Days"
          value={db.reports.reduce((s, r) => s + r.attendance.filter((a) => a.present).length, 0)}
        />
      </div>

      <div className="space-y-6">
        {foremen.map((foreman) => {
          const reports = db.reports
            .filter((r) => r.foremanId === foreman.id)
            .sort((a, b) => b.date.localeCompare(a.date))
          return (
            <Section
              key={foreman.id}
              title={foreman.name}
              description={`${reports.length} report(s) filed`}
            >
              {reports.length === 0 ? (
                <EmptyState title="No reports filed." />
              ) : (
                <Table head={['Date', 'Site', 'Workers', 'Hours', 'OT', 'Work Done', 'Status', '']}>
                  {reports.map((report) => (
                    <tr key={report.id} className="row-hover">
                      <td className="td tabular-nums font-medium text-stone-900">{formatDate(report.date)}</td>
                      <td className="td"><SiteName name={report.siteLocation} /></td>
                      <td className="td tabular-nums">{report.attendance.filter((a) => a.present).length}</td>
                      <td className="td tabular-nums">
                        {formatDuration(minutesBetween(report.startTime, report.endTime))}
                      </td>
                      <td className="td tabular-nums">{report.otHours ? `${report.otHours}h` : '—'}</td>
                      <td className="td max-w-xs truncate">
                        {report.workDone.filter((w) => w.trim()).join('; ') || '—'}
                      </td>
                      <td className="td"><StatusBadge status={report.status} /></td>
                      <td className="td">
                        <Link to={`/execution/reports/${report.id}`} className="text-sm font-semibold text-brand-700">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </Section>
          )
        })}
      </div>
    </div>
  )
}
