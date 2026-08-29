import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { can } from '../../domain/roles'
import {
  formatDate, formatDuration, formatTime, minutesBetween,
} from '../../domain/format'
import {
  PageHeader, Section, StatusBadge, SiteName, Table, EmptyState, Badge, Field,
} from '../../components/ui'
import { RepeaterView } from '../../components/RepeaterList'
import { PhotoGrid } from '../../components/PhotoGrid'
import { Icon } from '../../components/Icon'

/**
 * §15 — the Execution Project Manager reviews a submitted report and either
 * approves it or sends it back to the foreman with a note.
 */
export function ReportReview() {
  const { reportId = '' } = useParams()
  const db = useDb()
  const { user, roleKey } = useSession()
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const [showSendBack, setShowSendBack] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const report = db.reports.find((r) => r.id === reportId)
  if (!report) return <EmptyState title="Report not found." />

  const project = db.projects.find((p) => p.id === report.projectId)
  const foreman = db.employees.find((e) => e.id === report.foremanId)
  const reviewer = db.employees.find((e) => e.id === report.reviewedBy)
  const presentWorkers = report.attendance.filter((a) => a.present)
  const regularMinutes = minutesBetween(report.startTime, report.endTime)
  const reportIssues = db.issues.filter((i) => i.reportId === report.id)
  const generatedTasks = db.tasks.filter((t) => t.fromReportId === report.id)

  const canReview = can.reviewReports(roleKey) && report.status === 'Submitted'
  const workerName = (id: string) => db.workers.find((w) => w.id === id)?.name ?? id

  const sendBack = () => {
    if (!note.trim()) return setError('Add a note so the foreman knows what to correct.')
    setError(null)
    api.reports.sendBack(report.id, user.id, note.trim())
    navigate('/execution/reports')
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Daily Work Report"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span><SiteName name={report.siteLocation} /></span>
            <span className="text-stone-300">·</span>
            <span>{formatDate(report.date)}</span>
            <span className="text-stone-300">·</span>
            <span>{foreman?.name}</span>
          </span>
        }
        actions={<StatusBadge status={report.status} />}
      />

      {report.status === 'Approved' && report.reviewNote && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-brand-900">
            Approved by {reviewer?.name} at {formatTime(report.reviewedAt ?? '')}
          </p>
          <p className="mt-1 text-sm text-brand-800">{report.reviewNote}</p>
        </div>
      )}
      {report.status === 'Sent Back' && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">
            Sent back by {reviewer?.name} at {formatTime(report.reviewedAt ?? '')}
          </p>
          <p className="mt-1 text-sm text-red-800">{report.reviewNote}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Summary" className="lg:col-span-1">
          <dl className="space-y-3 px-5 py-5 text-sm">
            {[
              ['Project', <Link key="p" to={`/projects/${report.projectId}`} className="font-medium text-brand-700">{project?.name}</Link>],
              ['Site', <SiteName key="s" name={report.siteLocation} />],
              ['Date', formatDate(report.date)],
              ['Foreman', foreman?.name ?? '—'],
              ['Workers Present', <span key="w" className="font-bold tabular-nums">{presentWorkers.length}</span>],
              ['Start Time', formatTime(report.startTime)],
              ['End Time', formatTime(report.endTime)],
              ['Regular Hours', <span key="r" className="font-semibold">{formatDuration(regularMinutes)}</span>],
            ].map(([label, value], i) => (
              <div key={i} className="flex justify-between gap-3">
                <dt className="text-stone-500">{label}</dt>
                <dd className="text-right text-stone-800">{value}</dd>
              </div>
            ))}

            <div className="flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
              <dt className="text-stone-500">OT</dt>
              <dd>
                {can.adjustOt(roleKey) ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number" min={0} step={0.5} value={report.otHours}
                      onChange={(e) => api.reports.setOt(report.id, Number(e.target.value))}
                      className="input w-20 py-1 text-right"
                      aria-label="Adjust overtime hours"
                    />
                    <span className="text-sm text-stone-500">h</span>
                  </div>
                ) : (
                  <span className="font-semibold tabular-nums text-stone-800">{report.otHours}h</span>
                )}
              </dd>
            </div>
            {can.adjustOt(roleKey) && (
              <p className="text-xs text-stone-400">
                Overtime is set here, not on site.
              </p>
            )}

            {report.submittedAt && (
              <div className="flex justify-between gap-3 border-t border-stone-100 pt-3">
                <dt className="text-stone-500">Submitted</dt>
                <dd className="text-right text-stone-800">
                  {foreman?.name} · {formatTime(report.submittedAt)}
                </dd>
              </div>
            )}
          </dl>
        </Section>

        <div className="space-y-6 lg:col-span-2">
          <Section title="Work Done Today">
            <div className="px-5 py-4">
              <RepeaterView values={report.workDone} empty="No work recorded" />
            </div>
          </Section>

          <Section
            title="Issues / Delays"
            actions={reportIssues.length > 0 && <Badge tone="red">{reportIssues.length} alert(s)</Badge>}
          >
            <div className="px-5 py-4">
              <RepeaterView values={report.issues} empty="Nothing reported" />
              {reportIssues.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
                  <p className="label">Alerts raised to you</p>
                  {reportIssues.map((issue) => (
                    <div key={issue.id} className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2">
                      <span className="min-w-0 flex-1 text-sm text-stone-700">{issue.text}</span>
                      {issue.status === 'Open' ? (
                        <button onClick={() => api.issues.resolve(issue.id)} className="btn-secondary shrink-0 py-1 text-xs">
                          Mark resolved
                        </button>
                      ) : (
                        <StatusBadge status="Resolved" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          <Section
            title="Next Day Plan"
            description={report.status === 'Approved'
              ? 'Approved — these became tasks.'
              : 'Approving this report turns each line into a task for tomorrow.'}
          >
            <div className="px-5 py-4">
              <RepeaterView values={report.nextDayPlan} empty="No plan recorded" />
              {generatedTasks.length > 0 && (
                <div className="mt-4 border-t border-stone-100 pt-4">
                  <p className="label mb-2">Tasks created</p>
                  <ul className="space-y-1.5">
                    {generatedTasks.map((task) => (
                      <li key={task.id} className="flex items-center gap-2 text-sm text-stone-700">
                        <Icon name="check" className="h-4 w-4 shrink-0 text-brand-600" />
                        {task.title}
                        <span className="text-xs text-stone-400">due {formatDate(task.dueDate)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Attendance" description="Linked to date, site, foreman, project and worker.">
          {presentWorkers.length === 0 ? (
            <EmptyState title="No workers marked present." />
          ) : (
            <Table head={['Worker', 'Check-in', 'Check-out']}>
              {presentWorkers.map((entry) => (
                <tr key={entry.workerId} className="row-hover">
                  <td className="td font-medium text-stone-900">{workerName(entry.workerId)}</td>
                  <td className="td tabular-nums">{formatTime(entry.checkIn || report.startTime)}</td>
                  <td className="td tabular-nums">{formatTime(entry.checkOut || report.endTime)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        <Section
          title="TA"
          description={db.settings.taEnabled
            ? `Calculated at ₹${db.settings.taRatePerKm}/km.`
            : 'Distances only — no rate configured.'}
        >
          {report.ta.length === 0 ? (
            <EmptyState title="No TA recorded." />
          ) : (
            <Table head={['Worker', 'Distance', ...(db.settings.taEnabled ? ['Amount'] : [])]}>
              {report.ta.map((entry) => (
                <tr key={entry.workerId} className="row-hover">
                  <td className="td font-medium text-stone-900">{workerName(entry.workerId)}</td>
                  <td className="td tabular-nums">{entry.distanceKm} km</td>
                  {db.settings.taEnabled && (
                    <td className="td tabular-nums">
                      ₹{(entry.distanceKm * db.settings.taRatePerKm).toLocaleString('en-IN')}
                    </td>
                  )}
                </tr>
              ))}
            </Table>
          )}
        </Section>
      </div>

      <Section title="Photos" className="mt-6">
        <div className="px-5 py-4">
          <PhotoGrid photos={report.photos} onChange={() => {}} disabled />
        </div>
      </Section>

      {canReview && (
        <Section title="Review" className="mt-6">
          <div className="space-y-4 px-5 py-5">
            {!showSendBack ? (
              <>
                <Field label="Note (optional)">
                  <textarea
                    value={note} rows={2} placeholder="Anything to pass back to the foreman"
                    onChange={(e) => setNote(e.target.value)}
                    className="input"
                  />
                </Field>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      api.reports.approve(report.id, user.id, note.trim() || undefined)
                      navigate('/execution/reports')
                    }}
                    className="btn-primary"
                  >
                    Approve
                  </button>
                  <button onClick={() => setShowSendBack(true)} className="btn-danger">
                    Send Back
                  </button>
                </div>
              </>
            ) : (
              <>
                <Field label="Why is this being sent back?" required>
                  <textarea
                    value={note} rows={3} autoFocus
                    placeholder="e.g. Work timing does not match the attendance sheet"
                    onChange={(e) => setNote(e.target.value)}
                    className="input"
                  />
                </Field>
                {error && <p className="text-sm text-red-700">{error}</p>}
                <div className="flex flex-wrap gap-3">
                  <button onClick={sendBack} className="btn-danger">Confirm Send Back</button>
                  <button onClick={() => { setShowSendBack(false); setError(null) }} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </Section>
      )}

      <Link
        to="/execution/reports"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800"
      >
        <Icon name="back" className="h-4 w-4" /> All reports
      </Link>
    </div>
  )
}
