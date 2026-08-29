import { useNavigate } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { formatDateLong, today } from '../../domain/format'
import { SiteName, StatusBadge } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { FieldCard } from '../../shells/FieldShell'

/** Step one of the foreman flow: MY SITES → SELECT SITE → DAILY WORK REPORT. */
export function MySites() {
  const db = useDb()
  const { user } = useSession()
  const navigate = useNavigate()

  const myProjectIds = db.siteAssignments
    .filter((a) => a.foremanId === user.id)
    .map((a) => a.projectId)

  const sites = db.projects.filter(
    (p) => myProjectIds.includes(p.id) && p.status !== 'Completed',
  )

  return (
    <div>
      <h1 className="text-xl font-bold text-stone-900">My Sites</h1>
      <p className="mt-1 text-sm text-stone-500">
        Select a site to file today's work report — {formatDateLong(today())}
      </p>

      <div className="mt-5 space-y-3">
        {sites.map((site) => {
          const report = db.reports.find(
            (r) => r.projectId === site.id && r.foremanId === user.id && r.date === today(),
          )
          return (
            <FieldCard key={site.id} onClick={() => navigate(`/field/report/${site.id}`)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-stone-900">
                    <SiteName name={site.siteLocation} />
                  </p>
                  <p className="mt-0.5 truncate text-sm text-stone-500">{site.name}</p>
                  <p className="mt-2 text-xs font-medium text-stone-400">{site.code}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {report ? (
                    <StatusBadge status={report.status} />
                  ) : (
                    <span className="text-xs font-medium text-stone-400">Not started</span>
                  )}
                  <Icon name="chevron" className="h-5 w-5 text-stone-300" />
                </div>
              </div>
              {report?.status === 'Sent Back' && report.reviewNote && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                  <span className="font-semibold">Sent back:</span> {report.reviewNote}
                </p>
              )}
            </FieldCard>
          )
        })}

        {sites.length === 0 && (
          <FieldCard>
            <p className="py-6 text-center text-sm text-stone-400">
              No sites assigned to you at the moment.
            </p>
          </FieldCard>
        )}
      </div>
    </div>
  )
}
