import { useState } from 'react'
import { useDb } from '../../state/useDb'
import { formatDate, formatTime, today } from '../../domain/format'
import {
  PageHeader, Section, SiteName, Table, EmptyState, StatTile, Badge, StatusBadge,
} from '../../components/ui'

/**
 * Attendance is a by-product of the daily report — the system associates each
 * entry with date, site, foreman, project, worker and check-in/out.
 */
export function Attendance() {
  const db = useDb()
  const [date, setDate] = useState(today())

  const reports = db.reports.filter((r) => r.date === date)
  const rows = reports.flatMap((report) =>
    report.attendance
      .filter((entry) => entry.present)
      .map((entry) => ({ report, entry })),
  )

  const workerName = (id: string) => db.workers.find((w) => w.id === id)?.name ?? id
  const foremanName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'
  const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Recorded automatically from the foremen's daily work reports."
        actions={
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="input w-auto" aria-label="Attendance date"
          />
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Workers Present" value={rows.length} tone="green" />
        <StatTile label="Sites Reporting" value={reports.length} />
        <StatTile
          label="Approved Reports"
          value={reports.filter((r) => r.status === 'Approved').length}
          tone="green"
        />
        <StatTile
          label="Awaiting Review"
          value={reports.filter((r) => r.status === 'Submitted').length}
          tone={reports.some((r) => r.status === 'Submitted') ? 'amber' : 'stone'}
        />
      </div>

      <Section title={`Attendance — ${formatDate(date)}`}>
        {rows.length === 0 ? (
          <EmptyState
            title="No attendance recorded for this date."
            hint="Attendance appears once a foreman files a daily report."
          />
        ) : (
          <Table head={['Worker', 'Site', 'Project', 'Foreman', 'Check-in', 'Check-out', 'Report']}>
            {rows.map(({ report, entry }) => (
              <tr key={`${report.id}-${entry.workerId}`} className="row-hover">
                <td className="td font-medium text-stone-900">{workerName(entry.workerId)}</td>
                <td className="td"><SiteName name={report.siteLocation} /></td>
                <td className="td">{projectName(report.projectId)}</td>
                <td className="td">{foremanName(report.foremanId)}</td>
                <td className="td tabular-nums">{formatTime(entry.checkIn || report.startTime)}</td>
                <td className="td tabular-nums">{formatTime(entry.checkOut || report.endTime)}</td>
                <td className="td"><StatusBadge status={report.status} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title="Worker Totals" description="Days present in the last 30 days" className="mt-6">
        <Table head={['Worker', 'Skill', 'Days Present', 'Last Seen']}>
          {db.workers.filter((w) => w.active).map((worker) => {
            const entries = db.reports.filter((r) =>
              r.attendance.some((a) => a.workerId === worker.id && a.present),
            )
            const last = entries.sort((a, b) => b.date.localeCompare(a.date))[0]
            return (
              <tr key={worker.id} className="row-hover">
                <td className="td font-medium text-stone-900">{worker.name}</td>
                <td className="td">{worker.skill}</td>
                <td className="td">
                  <Badge tone={entries.length ? 'green' : 'stone'}>{entries.length}</Badge>
                </td>
                <td className="td tabular-nums">
                  {last ? formatDate(last.date) : <span className="text-stone-400">—</span>}
                </td>
              </tr>
            )
          })}
        </Table>
      </Section>
    </div>
  )
}
