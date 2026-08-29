import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { can } from '../../domain/roles'
import {
  formatDate, formatDuration, formatTime, minutesBetween, today,
} from '../../domain/format'
import type { DailyWorkReport, ReportWorkerEntry } from '../../domain/types'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { RepeaterList } from '../../components/RepeaterList'
import { WorkerPicker } from '../../components/WorkerPicker'
import { PhotoGrid } from '../../components/PhotoGrid'
import { Icon } from '../../components/Icon'
import { SiteName, StatusBadge } from '../../components/ui'

function FormSection({
  n, title, hint, children,
}: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <header className="mb-3">
        <h2 className="flex items-baseline gap-2 font-semibold text-stone-900">
          <span className="text-sm font-bold tabular-nums text-brand-600">{n}.</span>
          {title}
        </h2>
        {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
      </header>
      {children}
    </section>
  )
}

/**
 * The paper daily work report, digitised section by section in the order the
 * client's own form uses. Everything the form asked a foreman to work out by
 * hand — the headcount, the hours — is calculated here instead.
 */
export function DailyWorkReportForm() {
  const { projectId = '' } = useParams()
  const db = useDb()
  const { user, roleKey } = useSession()
  const navigate = useNavigate()

  const project = db.projects.find((p) => p.id === projectId)
  const [reportId, setReportId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DailyWorkReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Open (or create) today's report for this foreman and site.
  useEffect(() => {
    if (!project) return
    const report = api.reports.draftFor(project.id, user.id, today())
    setReportId(report.id)
    setDraft(structuredClone(report))
  }, [project?.id, user.id])

  // Pull in a reviewer's decision if the report was approved or sent back.
  const stored = db.reports.find((r) => r.id === reportId)
  useEffect(() => {
    if (stored && draft && stored.status !== draft.status) {
      setDraft(structuredClone(stored))
    }
  }, [stored?.status])

  const workers = useMemo(() => db.workers.filter((w) => w.active), [db.workers])
  const settings = db.settings

  if (!project || !draft) {
    return <p className="text-sm text-stone-500">Site not found.</p>
  }

  const locked = draft.status === 'Submitted' || draft.status === 'Approved'
  const presentWorkers = draft.attendance.filter((a) => a.present)
  const totalPresent = presentWorkers.length
  const regularMinutes = minutesBetween(draft.startTime, draft.endTime)

  const patch = (changes: Partial<DailyWorkReport>) => {
    const next = { ...draft, ...changes }
    setDraft(next)
    api.reports.save(next)
  }

  /**
   * A worker's check-in/out is only stored when the foreman overrides it —
   * otherwise it follows the day's work timing, which may be entered after
   * the workers were ticked.
   */
  const setAttendance = (attendance: ReportWorkerEntry[]) => {
    patch({
      attendance,
      // Keep the TA table in step with who is actually on site.
      ta: draft.ta.filter((t) => attendance.find((a) => a.workerId === t.workerId)?.present),
    })
  }

  const setTaDistance = (workerId: string, km: number) => {
    const existing = draft.ta.find((t) => t.workerId === workerId)
    patch({
      ta: existing
        ? draft.ta.map((t) => (t.workerId === workerId ? { ...t, distanceKm: km } : t))
        : [...draft.ta, { workerId, distanceKm: km }],
    })
  }

  const workerName = (id: string) => db.workers.find((w) => w.id === id)?.name ?? id

  const submit = () => {
    if (totalPresent === 0) return setError('Select at least one worker who was present.')
    if (!draft.startTime || !draft.endTime) return setError('Enter the work start and end time.')
    if (regularMinutes === 0) return setError('The end time must be after the start time.')
    if (!draft.workDone.some((w) => w.trim())) return setError('Record at least one item of work done.')
    if (settings.photosMandatory && draft.photos.length === 0) {
      return setError('At least one site photo is required before submitting.')
    }
    setError(null)
    api.reports.submit(draft.id, user.id)
    navigate('/field/submitted/' + draft.id)
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/field')} className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <Icon name="back" className="h-4 w-4" /> My Sites
      </button>

      {/* Report header — Date, Site, Foreman */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-bold text-stone-900">Daily Work Report</h1>
          <StatusBadge status={draft.status} />
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex gap-3">
            <dt className="flex w-20 shrink-0 items-center gap-1.5 text-stone-500">
              <Icon name="calendar" className="h-4 w-4" /> Date
            </dt>
            <dd className="font-medium text-stone-800">{formatDate(draft.date)}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="flex w-20 shrink-0 items-center gap-1.5 text-stone-500">
              <Icon name="pin" className="h-4 w-4" /> Site
            </dt>
            <dd className="font-medium text-stone-800"><SiteName name={draft.siteLocation} /></dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 pl-[22px] text-stone-500">Foreman</dt>
            <dd className="font-medium text-stone-800">{user.name}</dd>
          </div>
        </dl>
      </div>

      {draft.status === 'Sent Back' && draft.reviewNote && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">Sent back for correction</p>
          <p className="mt-1 text-sm text-red-800">{draft.reviewNote}</p>
        </div>
      )}

      <FormSection n={1} title="Total Workers Present" hint="Tick who was on site — the total is calculated for you.">
        <div className="mb-3 flex items-baseline gap-2 rounded-lg bg-brand-50 px-3 py-2.5">
          <span className="text-sm font-medium text-brand-900">Total Workers Present:</span>
          <span className="text-2xl font-bold tabular-nums text-brand-700">{totalPresent}</span>
        </div>
        <WorkerPicker
          workers={workers}
          attendance={draft.attendance}
          onChange={setAttendance}
          disabled={locked}
        />
      </FormSection>

      <FormSection n={2} title="Work Timing">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Work Started At</span>
            <input
              type="time" value={draft.startTime} disabled={locked}
              onChange={(e) => patch({ startTime: e.target.value })}
              className="input mt-1.5"
            />
          </label>
          <label className="block">
            <span className="label">Work Ended At</span>
            <input
              type="time" value={draft.endTime} disabled={locked}
              onChange={(e) => patch({ endTime: e.target.value })}
              className="input mt-1.5"
            />
          </label>
        </div>

        <dl className="mt-4 space-y-1.5 rounded-lg bg-stone-50 px-3 py-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">Start Time</dt>
            <dd className="font-medium tabular-nums text-stone-800">{formatTime(draft.startTime)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">End Time</dt>
            <dd className="font-medium tabular-nums text-stone-800">{formatTime(draft.endTime)}</dd>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-1.5">
            <dt className="font-medium text-stone-600">Regular Hours</dt>
            <dd className="font-bold tabular-nums text-stone-900">{formatDuration(regularMinutes)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-stone-500">OT</dt>
            <dd className="flex items-center gap-2">
              {can.adjustOt(roleKey) ? (
                <input
                  type="number" min={0} step={0.5} value={draft.otHours}
                  onChange={(e) => patch({ otHours: Math.max(0, Number(e.target.value)) })}
                  className="input w-20 py-1 text-right"
                />
              ) : (
                <span className="font-medium tabular-nums text-stone-800">{draft.otHours}h</span>
              )}
            </dd>
          </div>
        </dl>
        {!can.adjustOt(roleKey) && (
          <p className="mt-2 text-xs text-stone-400">
            Overtime is adjusted by the Execution Project Manager, not on site.
          </p>
        )}
      </FormSection>

      <FormSection n={3} title="Work Done Today">
        <RepeaterList
          values={draft.workDone} onChange={(workDone) => patch({ workDone })}
          addLabel="Add Work" placeholder="e.g. Soil preparation completed"
          disabled={locked}
        />
      </FormSection>

      <FormSection
        n={4} title="Issues / Delays"
        hint={'Leave as "Nothing" if the day ran clean. Anything else raises an alert for the Execution Project Manager.'}
      >
        <RepeaterList
          values={draft.issues} onChange={(issues) => patch({ issues })}
          addLabel="Add Issue" placeholder="Nothing" disabled={locked}
        />
      </FormSection>

      <FormSection n={5} title="Next Day Plan" hint="Approved plans become tomorrow's tasks.">
        <RepeaterList
          values={draft.nextDayPlan} onChange={(nextDayPlan) => patch({ nextDayPlan })}
          addLabel="Add Plan" placeholder="e.g. Continue planting in the rear garden"
          disabled={locked}
        />
      </FormSection>

      <FormSection
        n={6} title="TA"
        hint={settings.taEnabled
          ? `Distance is recorded per worker. Configured rate: ₹${settings.taRatePerKm}/km.`
          : 'Distance is recorded per worker. The rate is not configured, so no amount is calculated.'}
      >
        {totalPresent === 0 ? (
          <p className="text-sm text-stone-400">Select the workers present first.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-stone-200">
            <table className="w-full">
              <thead className="bg-stone-50">
                <tr>
                  <th className="th">Worker</th>
                  <th className="th text-right">Distance</th>
                  {settings.taEnabled && <th className="th text-right">Amount</th>}
                </tr>
              </thead>
              <tbody>
                {presentWorkers.map((entry) => {
                  const km = draft.ta.find((t) => t.workerId === entry.workerId)?.distanceKm ?? 0
                  return (
                    <tr key={entry.workerId} className="border-t border-stone-100">
                      <td className="td">{workerName(entry.workerId)}</td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number" min={0} value={km || ''} placeholder="0" disabled={locked}
                            onChange={(e) => setTaDistance(entry.workerId, Number(e.target.value))}
                            className="input w-20 py-1 text-right"
                          />
                          <span className="text-sm text-stone-500">km</span>
                        </div>
                      </td>
                      {settings.taEnabled && (
                        <td className="td text-right font-medium tabular-nums">
                          ₹{(km * settings.taRatePerKm).toLocaleString('en-IN')}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>

      <FormSection
        n={7} title="Attendance"
        hint="Linked automatically to date, site, foreman, project and worker."
      >
        {totalPresent === 0 ? (
          <p className="text-sm text-stone-400">No workers marked present.</p>
        ) : (
          <div className="space-y-2">
            {presentWorkers.map((entry) => (
              <div key={entry.workerId} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">
                  {workerName(entry.workerId)}
                </span>
                <input
                  type="time" value={entry.checkIn || draft.startTime} disabled={locked}
                  onChange={(e) => patch({
                    attendance: draft.attendance.map((a) =>
                      a.workerId === entry.workerId ? { ...a, checkIn: e.target.value } : a),
                  })}
                  className="input w-28 py-1"
                  aria-label={`Check-in for ${workerName(entry.workerId)}`}
                />
                <span className="text-stone-400">–</span>
                <input
                  type="time" value={entry.checkOut || draft.endTime} disabled={locked}
                  onChange={(e) => patch({
                    attendance: draft.attendance.map((a) =>
                      a.workerId === entry.workerId ? { ...a, checkOut: e.target.value } : a),
                  })}
                  className="input w-28 py-1"
                  aria-label={`Check-out for ${workerName(entry.workerId)}`}
                />
              </div>
            ))}
          </div>
        )}
      </FormSection>

      <FormSection
        n={8} title="Photos"
        hint={settings.photosMandatory ? 'At least one photo is required.' : 'Photos are optional.'}
      >
        <PhotoGrid photos={draft.photos} onChange={(photos) => patch({ photos })} disabled={locked} />
      </FormSection>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {locked ? (
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-center shadow-sm">
          <p className="text-sm font-semibold text-stone-700">
            {draft.status === 'Approved' ? 'This report has been approved.' : 'Submitted and awaiting review.'}
          </p>
          {draft.submittedAt && (
            <p className="mt-1 text-xs text-stone-500">
              Submitted by {user.name} at {formatTime(draft.submittedAt)}
            </p>
          )}
        </div>
      ) : (
        <button onClick={submit} className="btn-primary w-full py-3.5 text-base">
          Submit Daily Report
        </button>
      )}
    </div>
  )
}
