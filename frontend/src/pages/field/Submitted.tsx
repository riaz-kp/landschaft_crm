import { Link, useParams } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { formatDate, formatTime } from '../../domain/format'
import { SiteName } from '../../components/ui'
import { Icon } from '../../components/Icon'

/** Confirmation after §14 — Submit Daily Report. */
export function Submitted() {
  const { reportId = '' } = useParams()
  const db = useDb()
  const { user } = useSession()

  const report = db.reports.find((r) => r.id === reportId)
  if (!report) return <p className="text-sm text-stone-500">Report not found.</p>

  const issueCount = db.issues.filter((i) => i.reportId === report.id).length

  return (
    <div className="pt-6">
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-brand-700" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <h1 className="mt-4 text-lg font-bold text-stone-900">Report Submitted</h1>
        <p className="mt-1 text-sm text-stone-500">
          Sent to the Execution Project Manager for review.
        </p>

        <dl className="mt-5 space-y-2 border-t border-stone-100 pt-5 text-left text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">Site</dt>
            <dd className="font-medium text-stone-800"><SiteName name={report.siteLocation} /></dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Date</dt>
            <dd className="font-medium tabular-nums text-stone-800">{formatDate(report.date)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Status</dt>
            <dd className="font-medium text-amber-700">{report.status}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Submitted by</dt>
            <dd className="font-medium text-stone-800">{user.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Submitted at</dt>
            <dd className="font-medium tabular-nums text-stone-800">{formatTime(report.submittedAt ?? '')}</dd>
          </div>
        </dl>

        {issueCount > 0 && (
          <p className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            {issueCount === 1 ? '1 issue was' : `${issueCount} issues were`} flagged to the Execution Project Manager.
          </p>
        )}
      </div>

      <Link to="/field" className="btn-secondary mt-4 w-full py-3">
        Back to My Sites
      </Link>
    </div>
  )
}
