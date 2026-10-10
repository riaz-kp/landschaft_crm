import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { formatDate, formatDateLong, formatDuration, formatTime, minutesBetween, today } from '../../domain/format'
import { SiteName, StatusBadge } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { PhotoGrid } from '../../components/PhotoGrid'
import { RepeaterView } from '../../components/RepeaterList'
import { FieldCard } from '../../shells/FieldShell'
import { FieldCrewList } from './FieldWorkers'

function monthName(month: string) {
  return new Date(month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/** The foreman's past work: their daily reports, and the workers who were on them. */
export function FieldWorks() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'workers' ? 'workers' : 'reports'

  return (
    <div>
      <h1 className="text-xl font-bold text-stone-900">My Past Works</h1>
      <p className="mt-1 text-sm text-stone-500">
        {view === 'reports' ? 'Every daily report you have filed, by month.' : 'Everyone who has worked under you, and the days they were on site.'}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-stone-200/60 p-1">
        {([['reports', 'Reports', 'doc'], ['workers', 'My workers', 'users']] as const).map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setParams(key === 'reports' ? {} : { view: key }, { replace: true })}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition ${
              view === key ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-500'
            }`}
          >
            <Icon name={icon} className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      <div className="mt-4">{view === 'reports' ? <ReportList /> : <FieldCrewList />}</div>
    </div>
  )
}

function ReportList() {
  const db = useDb()
  const { user } = useSession()
  const navigate = useNavigate()

  const mine = db.reports
    .filter((r) => r.foremanId === user.id && (r.status !== 'Draft' || r.date === today()))
    .sort((a, b) => b.date.localeCompare(a.date))
  const months = [...new Set(mine.map((r) => r.date.slice(0, 7)))]
  const [month, setMonth] = useState(months[0] ?? today().slice(0, 7))
  const [site, setSite] = useState('')

  const sites = [...new Set(mine.map((r) => r.projectId))]
  const shown = mine.filter((r) => r.date.startsWith(month) && (!site || r.projectId === site))
  const days = new Set(shown.map((r) => r.date)).size
  const workerDays = shown.reduce((s, r) => s + r.attendance.filter((a) => a.present).length, 0)
  const approved = shown.filter((r) => r.status === 'Approved').length
  const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? ''

  return (
    <div>
      <div className="flex gap-2">
        <select className="input flex-1" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
          {(months.length ? months : [month]).map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
        </select>
        <select className="input flex-1" value={site} onChange={(e) => setSite(e.target.value)} aria-label="Site">
          <option value="">All my sites</option>
          {sites.map((id) => <option key={id} value={id}>{projectName(id)}</option>)}
        </select>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ['Days on site', days],
          ['Reports', shown.length],
          ['Worker-days', workerDays],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-stone-200 bg-white p-3 text-center shadow-card">
            <p className="font-display text-2xl font-bold tabular-nums text-stone-900">{value}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
          </div>
        ))}
      </div>
      {shown.length > 0 && (
        <p className="mt-2 text-center text-xs text-stone-500">{approved} of {shown.length} approved by the Execution PM</p>
      )}

      <div className="mt-5 space-y-3">
        {shown.map((r) => {
          const minutes = minutesBetween(r.startTime, r.endTime)
          return (
            <FieldCard key={r.id} onClick={() => navigate(`/field/works/${r.id}`)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900">{r.date === today() ? 'Today' : formatDateLong(r.date)}</p>
                  <p className="truncate text-sm text-stone-500"><SiteName name={r.siteLocation} /> · {projectName(r.projectId)}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-stone-500">
                <span className="flex items-center gap-1"><Icon name="users" className="h-3.5 w-3.5" /> {r.attendance.filter((a) => a.present).length} workers</span>
                {minutes > 0 && <span className="flex items-center gap-1"><Icon name="clock" className="h-3.5 w-3.5" /> {formatDuration(minutes)}</span>}
                <span className="flex items-center gap-1"><Icon name="camera" className="h-3.5 w-3.5" /> {r.photos.length} photos</span>
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-stone-700">
                {r.workDone.filter(Boolean).slice(0, 2).map((w, i) => <li key={i}>{w}</li>)}
              </ul>
              {r.photos.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {r.photos.slice(0, 4).map((p) => <img key={p.id} src={p.src} alt="" className="h-14 w-14 rounded-lg object-cover" />)}
                </div>
              )}
            </FieldCard>
          )
        })}
        {shown.length === 0 && (
          <FieldCard><p className="py-6 text-center text-sm text-stone-400">No reports for {monthName(month)}.</p></FieldCard>
        )}
      </div>
    </div>
  )
}

/** One past report, read-only. */
export function FieldReportView() {
  const { reportId = '' } = useParams()
  const db = useDb()
  const { user } = useSession()
  const report = db.reports.find((r) => r.id === reportId && r.foremanId === user.id)

  if (!report) return <p className="text-sm text-stone-500">Report not found.</p>

  const present = report.attendance.filter((a) => a.present)
  const workerName = (id: string) => db.workers.find((w) => w.id === id)?.name ?? id
  const reviewer = db.employees.find((e) => e.id === report.reviewedBy)?.name
  const editable = report.date === today() && (report.status === 'Draft' || report.status === 'Sent Back')

  return (
    <div className="space-y-4">
      <Link to="/field/works" className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <Icon name="back" className="h-4 w-4" /> My past works
      </Link>

      <FieldCard>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-stone-900">{formatDateLong(report.date)}</h1>
            <p className="text-sm text-stone-500"><SiteName name={report.siteLocation} /> · {db.projects.find((p) => p.id === report.projectId)?.name}</p>
          </div>
          <StatusBadge status={report.status} />
        </div>
        {report.reviewNote && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${report.status === 'Sent Back' ? 'bg-red-50 text-red-800' : 'bg-brand-50 text-brand-900'}`}>
            <span className="font-semibold">{reviewer ?? 'Reviewer'}:</span> {report.reviewNote}
          </p>
        )}
        {editable && (
          <Link to={`/field/report/${report.projectId}`} className="btn-primary mt-3 w-full">Open today's report</Link>
        )}
      </FieldCard>

      <FieldCard>
        <p className="label mb-2">Timing</p>
        <p className="text-sm text-stone-800">
          {formatTime(report.startTime)} – {formatTime(report.endTime)}
          <span className="ml-2 font-semibold">{formatDuration(minutesBetween(report.startTime, report.endTime))}</span>
          {report.otHours > 0 && <span className="ml-2 text-sky-700">+ {report.otHours}h OT</span>}
        </p>
      </FieldCard>

      <FieldCard>
        <p className="label mb-2">Workers present · {present.length}</p>
        <ul className="divide-y divide-stone-100">
          {present.map((a) => (
            <li key={a.workerId} className="flex items-center justify-between py-1.5 text-sm">
              <Link to={`/field/workers/${a.workerId}`} className="font-medium text-stone-800 hover:text-brand-700">{workerName(a.workerId)}</Link>
              <span className="tabular-nums text-stone-500">{formatTime(a.checkIn || report.startTime)} – {formatTime(a.checkOut || report.endTime)}</span>
            </li>
          ))}
        </ul>
      </FieldCard>

      {([['Work done', report.workDone], ['Issues / delays', report.issues], ['Next day plan', report.nextDayPlan]] as const).map(([title, values]) => (
        <FieldCard key={title}>
          <p className="label mb-2">{title}</p>
          <RepeaterView values={[...values]} empty="Nothing recorded" />
        </FieldCard>
      ))}

      <FieldCard>
        <p className="label mb-3">Site photos</p>
        <PhotoGrid photos={report.photos} onChange={() => {}} disabled />
      </FieldCard>

      {report.submittedAt && (
        <p className="text-center text-xs text-stone-400">Submitted {formatDate(report.date)} at {formatTime(report.submittedAt)}</p>
      )}
    </div>
  )
}
