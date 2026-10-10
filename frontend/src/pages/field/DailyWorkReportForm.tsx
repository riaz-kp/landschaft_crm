import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { can } from '../../domain/roles'
import {
  addDays, currentTime, formatDate, formatDuration, formatTime, minutesBetween, today,
} from '../../domain/format'
import { crewOf } from '../../domain/workers'
import { PHOTO_SESSIONS, type DailyWorkReport, type ReportWorkerEntry } from '../../domain/types'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { RepeaterList } from '../../components/RepeaterList'
import { WorkerPicker } from '../../components/WorkerPicker'
import { PhotoGrid } from '../../components/PhotoGrid'
import { ClockToggle, TimeInput } from '../../components/TimeInput'
import { Icon } from '../../components/Icon'
import { directionsUrl } from '../../components/mapLinks'
import { ProgressBar, SiteName, StatusBadge } from '../../components/ui'

function FormSection({
  n, id, title, hint, done, optional, aside, children,
}: {
  n: number; id: string; title: string; hint?: string
  /** A required step that is filled in shows a tick instead of its number. */
  done?: boolean
  optional?: boolean
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold text-stone-900">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
              done ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-500'
            }`}>
              {done ? <Icon name="check" className="h-3.5 w-3.5" /> : n}
            </span>
            {title}
            {optional && <span className="text-xs font-normal text-stone-400">optional</span>}
          </h2>
          {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  )
}

/** Rounds the current time to the nearest five minutes. */
function nowRounded(): string {
  const [h, m] = currentTime().split(':').map(Number)
  const total = Math.min(23 * 60 + 55, Math.round((h * 60 + m) / 5) * 5)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
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
  const [adjustTimes, setAdjustTimes] = useState(false)

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
  // Who has been on this foreman's sites in the last month, to list them first.
  const crewIds = useMemo(
    () => crewOf(db.reports, user.id, today()).filter((c) => c.lastDate >= addDays(today(), -30)).map((c) => c.workerId),
    [db.reports, user.id],
  )
  const settings = db.settings

  if (!project || !draft) {
    return <p className="text-sm text-stone-500">Site not found.</p>
  }

  const locked = draft.status === 'Submitted' || draft.status === 'Approved'
  const presentWorkers = draft.attendance.filter((a) => a.present)
  const totalPresent = presentWorkers.length
  const regularMinutes = minutesBetween(draft.startTime, draft.endTime)
  const timingClash = Boolean(draft.startTime && draft.endTime && regularMinutes === 0)
  const adjusted = presentWorkers.filter((a) => a.checkIn || a.checkOut).length

  // The required steps, in form order, for the progress card and submit bar.
  const steps = [
    { id: 'workers', label: 'Workers', done: totalPresent > 0 },
    { id: 'timing', label: 'Timing', done: regularMinutes > 0 },
    { id: 'work', label: 'Work done', done: draft.workDone.some((w) => w.trim()) },
    ...(settings.photosMandatory ? [{
      id: 'photos', label: 'Photos',
      done: PHOTO_SESSIONS.every((s) => draft.photos.some((p) => p.session === s)),
    }] : []),
  ]
  const doneCount = steps.filter((s) => s.done).length
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const patch = (changes: Partial<DailyWorkReport>) => {
    const next = { ...draft, ...changes }
    setDraft(next)
    setError(null)
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

  const setWorkerTime = (workerId: string, key: 'checkIn' | 'checkOut', value: string) => patch({
    attendance: draft.attendance.map((a) => (a.workerId === workerId ? { ...a, [key]: value } : a)),
  })

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
    if (totalPresent === 0) return fail('Select at least one worker who was present.', 'workers')
    if (!draft.startTime || !draft.endTime) return fail('Enter the work start and end time.', 'timing')
    if (regularMinutes === 0) return fail('The end time must be after the start time.', 'timing')
    if (!draft.workDone.some((w) => w.trim())) return fail('Record at least one item of work done.', 'work')
    if (settings.photosMandatory && !draft.photos.some((p) => p.session === 'Morning')) {
      return fail('Add the morning site photo before submitting.', 'photos')
    }
    if (settings.photosMandatory && !draft.photos.some((p) => p.session === 'Evening')) {
      return fail('Add the evening site photo before submitting.', 'photos')
    }
    setError(null)
    api.reports.submit(draft.id, user.id)
    navigate('/field/submitted/' + draft.id)
  }

  /** Shows the problem and takes the foreman to the section that needs it. */
  function fail(message: string, section: string) {
    setError(message)
    jump(section)
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/field')} className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <Icon name="back" className="h-4 w-4" /> My Sites
      </button>

      {/* Report header — Date, Site, Foreman — and how far along it is */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-stone-900">Daily Work Report</h1>
            <p className="mt-0.5 truncate text-sm text-stone-500">
              <SiteName name={draft.siteLocation} /> · {project.name}
            </p>
            <a
              href={directionsUrl(project.siteCoords ?? project.siteLocation)}
              target="_blank" rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700"
            >
              <Icon name="map" className="h-3.5 w-3.5" /> Directions to site
            </a>
          </div>
          <StatusBadge status={draft.status} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-stone-100 pt-3 text-sm">
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-stone-500"><Icon name="calendar" className="h-3.5 w-3.5" /> Date</dt>
            <dd className="mt-0.5 font-medium text-stone-800">{formatDate(draft.date)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-stone-500"><Icon name="user" className="h-3.5 w-3.5" /> Foreman</dt>
            <dd className="mt-0.5 truncate font-medium text-stone-800">{user.name}</dd>
          </div>
        </dl>

        {!locked && (
          <div className="mt-4 rounded-xl bg-stone-50 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-700">{doneCount} of {steps.length} required steps done</span>
              <span className="text-stone-400">Saves as you go</span>
            </div>
            <ProgressBar value={(doneCount / steps.length) * 100} size="sm" />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {steps.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => jump(s.id)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    s.done ? 'bg-brand-100 text-brand-800' : 'bg-white text-stone-600 ring-1 ring-inset ring-stone-200'
                  }`}
                >
                  <Icon name={s.done ? 'check' : 'clock'} className="h-3 w-3" /> {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {draft.status === 'Sent Back' && draft.reviewNote && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">Sent back for correction</p>
          <p className="mt-1 text-sm text-red-800">{draft.reviewNote}</p>
        </div>
      )}

      <FormSection
        n={1} id="workers" title="Workers Present" done={totalPresent > 0}
        hint="Tick who was on site — the total is counted for you."
        aside={
          <span className="flex shrink-0 flex-col items-end rounded-xl bg-brand-50 px-3 py-1">
            <span className="text-2xl font-bold leading-tight tabular-nums text-brand-700">{totalPresent}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-800/70">present</span>
          </span>
        }
      >
        <WorkerPicker
          workers={workers}
          attendance={draft.attendance}
          onChange={setAttendance}
          disabled={locked}
          crewIds={crewIds}
        />
      </FormSection>

      <FormSection n={2} id="timing" title="Work Timing" done={regularMinutes > 0} aside={<ClockToggle className="shrink-0" />}>
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          {([['startTime', 'Work started at'], ['endTime', 'Work ended at']] as const).map(([key, label]) => (
            <div key={key}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="label">{label}</span>
                {!locked && (
                  <button type="button" onClick={() => patch({ [key]: nowRounded() })} className="text-xs font-semibold text-brand-700 hover:text-brand-800">
                    Now
                  </button>
                )}
              </div>
              <TimeInput value={draft[key]} onChange={(v) => patch({ [key]: v })} disabled={locked} ariaLabel={label} />
            </div>
          ))}
        </div>
        {timingClash && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-700">
            <Icon name="alert" className="h-3.5 w-3.5" /> The end time must be after the start time.
          </p>
        )}

        <dl className="mt-4 grid grid-cols-3 divide-x divide-stone-200 rounded-xl bg-stone-50 py-2.5 text-center">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Hours</dt>
            <dd className="mt-0.5 font-bold tabular-nums text-stone-900">{regularMinutes ? formatDuration(regularMinutes) : '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Workers</dt>
            <dd className="mt-0.5 font-bold tabular-nums text-stone-900">{totalPresent}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">OT</dt>
            <dd className="mt-0.5 flex justify-center">
              {can.adjustOt(roleKey) ? (
                <input
                  type="number" min={0} step={0.5} value={draft.otHours}
                  onChange={(e) => patch({ otHours: Math.max(0, Number(e.target.value)) })}
                  className="input w-16 py-0.5 text-center"
                  aria-label="Overtime hours"
                />
              ) : (
                <span className="font-bold tabular-nums text-stone-900">{draft.otHours}h</span>
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

      <FormSection n={3} id="work" title="Work Done Today" done={draft.workDone.some((w) => w.trim())}>
        <RepeaterList
          values={draft.workDone} onChange={(workDone) => patch({ workDone })}
          addLabel="Add Work" placeholder="e.g. Soil preparation completed"
          disabled={locked}
        />
      </FormSection>

      <FormSection
        n={4} id="issues" title="Issues / Delays" optional
        hint={'Leave as "Nothing" if the day ran clean. Anything else raises an alert for the Execution Project Manager.'}
      >
        <RepeaterList
          values={draft.issues} onChange={(issues) => patch({ issues })}
          addLabel="Add Issue" placeholder="Nothing" disabled={locked}
        />
      </FormSection>

      <FormSection n={5} id="plan" title="Next Day Plan" optional hint="Approved plans become tomorrow's tasks.">
        <RepeaterList
          values={draft.nextDayPlan} onChange={(nextDayPlan) => patch({ nextDayPlan })}
          addLabel="Add Plan" placeholder="e.g. Continue planting in the rear garden"
          disabled={locked}
        />
      </FormSection>

      <FormSection
        n={6} id="ta" title="TA" optional
        hint={settings.taEnabled
          ? `Distance is recorded per worker. Configured rate: ₹${settings.taRatePerKm}/km.`
          : 'Distance is recorded per worker. The rate is not configured, so no amount is calculated.'}
      >
        {totalPresent === 0 ? (
          <p className="text-sm text-stone-400">Select the workers present first.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
            {presentWorkers.map((entry) => {
              const km = draft.ta.find((t) => t.workerId === entry.workerId)?.distanceKm ?? 0
              return (
                <li key={entry.workerId} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-stone-800">{workerName(entry.workerId)}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <input
                      type="number" min={0} inputMode="decimal" value={km || ''} placeholder="0" disabled={locked}
                      onChange={(e) => setTaDistance(entry.workerId, Number(e.target.value))}
                      className="input w-20 py-1 text-right"
                      aria-label={`Distance for ${workerName(entry.workerId)}`}
                    />
                    <span className="text-sm text-stone-500">km</span>
                  </span>
                  {settings.taEnabled && (
                    <span className="w-16 shrink-0 text-right text-sm font-medium tabular-nums">
                      ₹{(km * settings.taRatePerKm).toLocaleString('en-IN')}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </FormSection>

      <FormSection
        n={7} id="attendance" title="Attendance"
        hint="Linked automatically to date, site, foreman, project and worker."
      >
        {totalPresent === 0 ? (
          <p className="text-sm text-stone-400">No workers marked present.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-sm">
              <span className="text-stone-600">
                {adjusted === 0
                  ? <>All {totalPresent} follow the work timing{regularMinutes > 0 && <> — {formatTime(draft.startTime)} to {formatTime(draft.endTime)}</>}.</>
                  : <>{adjusted} of {totalPresent} have their own times.</>}
              </span>
              {!locked && (
                <button type="button" onClick={() => setAdjustTimes(!adjustTimes)} className="text-xs font-semibold text-brand-700">
                  {adjustTimes ? 'Done' : 'Adjust individual times'}
                </button>
              )}
            </div>
            {(adjustTimes || (locked && adjusted > 0)) && (
              <div className="mt-3 space-y-2">
                {presentWorkers.map((entry) => {
                  const own = Boolean(entry.checkIn || entry.checkOut)
                  return (
                    <div key={entry.workerId} className={`rounded-xl border px-3 py-2 ${own ? 'border-amber-200 bg-amber-50/40' : 'border-stone-200'}`}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-stone-800">{workerName(entry.workerId)}</span>
                        {own && !locked && (
                          <button
                            type="button"
                            onClick={() => patch({
                              attendance: draft.attendance.map((a) =>
                                a.workerId === entry.workerId ? { ...a, checkIn: undefined, checkOut: undefined } : a),
                            })}
                            className="shrink-0 text-xs font-semibold text-stone-500 hover:text-stone-800"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <TimeInput
                          size="sm" value={entry.checkIn || draft.startTime} disabled={locked}
                          onChange={(v) => setWorkerTime(entry.workerId, 'checkIn', v)}
                          ariaLabel={`Check-in for ${workerName(entry.workerId)}`}
                        />
                        <TimeInput
                          size="sm" value={entry.checkOut || draft.endTime} disabled={locked}
                          onChange={(v) => setWorkerTime(entry.workerId, 'checkOut', v)}
                          ariaLabel={`Check-out for ${workerName(entry.workerId)}`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </FormSection>

      <FormSection
        n={8} id="photos" title="Site Photos"
        done={settings.photosMandatory ? PHOTO_SESSIONS.every((s) => draft.photos.some((p) => p.session === s)) : undefined}
        optional={!settings.photosMandatory}
        hint={settings.photosMandatory
          ? 'Photograph the site twice a day — in the morning before work starts and in the evening when it ends. Both are required.'
          : 'Photograph the site in the morning before work starts and in the evening when it ends.'}
      >
        <div className="space-y-4">
          {PHOTO_SESSIONS.map((session) => {
            const count = draft.photos.filter((p) => p.session === session).length
            return (
              <div key={session} className={`rounded-xl border p-3 ${count ? 'border-brand-200 bg-brand-50/40' : 'border-stone-200'}`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                    <Icon name={session === 'Morning' ? 'sun' : 'moon'} className={`h-4 w-4 ${session === 'Morning' ? 'text-amber-500' : 'text-violet-500'}`} />
                    {session} photo
                    <span className="hidden text-xs font-normal text-stone-400 min-[400px]:inline">{session === 'Morning' ? 'before work starts' : 'at the end of the day'}</span>
                  </p>
                  {count > 0
                    ? <span className="flex items-center gap-1 text-xs font-semibold text-brand-700"><Icon name="check" className="h-3.5 w-3.5" /> {count} added</span>
                    : <span className="text-xs font-medium text-amber-700">{settings.photosMandatory ? 'Required' : 'Not added'}</span>}
                </div>
                <PhotoGrid photos={draft.photos} session={session} onChange={(photos) => patch({ photos })} disabled={locked} />
              </div>
            )
          })}
        </div>
      </FormSection>

      {locked ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-card">
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
        // Stays in reach above the tab bar while the foreman scrolls the form.
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-lift backdrop-blur">
          {error && (
            <p className="mb-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-red-600" /> {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1 text-xs text-stone-500">
              {doneCount === steps.length
                ? <span className="font-semibold text-brand-700">Ready to submit</span>
                : <>{steps.length - doneCount} step{steps.length - doneCount === 1 ? '' : 's'} left: {steps.filter((s) => !s.done).map((s) => s.label).join(', ')}</>}
            </span>
            <button onClick={submit} className="btn-primary shrink-0 px-5 py-3">
              Submit report
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
