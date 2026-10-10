import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { usePermissions } from '../../state/permissions'
import { addDays, daysBetween, formatCurrency, formatDate, formatDateLong, formatTime, today } from '../../domain/format'
import { daysOfMonth, indexRegister, indexWorkerReports, resolveDay, totalsFor } from '../../domain/attendance'
import {
  PageHeader, Section, EmptyState, Avatar, Badge, Tabs, StatTile, Table, StatusBadge, SiteName, ConfirmDialog,
} from '../../components/ui'
import { ContactNumbers } from '../../components/ContactFields'
import { Icon } from '../../components/Icon'
import { resizeImage } from '../../components/imageResize'
import { PersonAttendance } from './EmployeeAttendance'
import { WorkerFormModal } from './WorkerForm'
import { PersonPayments } from './PersonPayments'
import { foremenOf } from '../../domain/workers'

type Tab = 'overview' | 'attendance' | 'payments' | 'history' | 'amc'

/** "3 yrs 2 mos" between two ISO dates. */
function span(from: string, to: string): string {
  const months = Math.max(0, Math.floor(daysBetween(from, to) / 30.44))
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return `${rest} mo${rest === 1 ? '' : 's'}`
  return rest ? `${years} yr${years === 1 ? '' : 's'} ${rest} mo${rest === 1 ? '' : 's'}` : `${years} yr${years === 1 ? '' : 's'}`
}

/** One site worker: profile, attendance, the sites and reports they appear on, and AMC visits. */
export function WorkerDetail() {
  const { workerId = '' } = useParams()
  const db = useDb()
  const { can } = usePermissions()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // ?foreman= opens the work history filtered to one foreman.
  const [foremanFilter, setForemanFilter] = useState(params.get('foreman') ?? '')
  const [tab, setTab] = useState<Tab>(params.get('foreman') ? 'history' : 'overview')
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  const register = useMemo(() => indexRegister(db.attendance), [db.attendance])
  const workerReports = useMemo(() => indexWorkerReports(db.reports), [db.reports])

  const worker = db.workers.find((w) => w.id === workerId)
  if (!worker) return <Section><EmptyState title="Worker not found." hint="They may have been removed." icon="hardhat" /></Section>

  const canEdit = can('Employees', 'edit')
  const reports = db.reports
    .filter((r) => r.status !== 'Draft' && r.attendance.some((a) => a.workerId === worker.id && a.present))
    .sort((a, b) => b.date.localeCompare(a.date))
  const amcVisits = db.maintenance.flatMap((m) =>
    m.visits.filter((v) => v.teamIds.includes(worker.id)).map((v) => ({ record: m, visit: v })),
  ).sort((a, b) => b.visit.date.localeCompare(a.visit.date))

  const month = today().slice(0, 7)
  const monthTotals = totalsFor(
    daysOfMonth(month).filter((d) => d <= today()).map((date) => ({ date, day: resolveDay('worker', worker.id, date, register, workerReports) })),
    db.settings.holidays,
  )
  const todayDay = resolveDay('worker', worker.id, today(), register, workerReports)

  // Sites worked in the last 30 days, busiest first.
  const since = addDays(today(), -30)
  const siteDays = new Map<string, number>()
  for (const r of reports.filter((r) => r.date >= since)) siteDays.set(r.projectId, (siteDays.get(r.projectId) ?? 0) + 1)
  const sites = [...siteDays.entries()].sort((a, b) => b[1] - a[1])

  const foremen = foremenOf(db.reports, worker.id)
  const history = foremanFilter ? reports.filter((r) => r.foremanId === foremanFilter) : reports
  const showHistoryFor = (foremanId: string) => { setForemanFilter(foremanId); setTab('history') }

  const totalKm = reports.reduce((s, r) => s + (r.ta.find((t) => t.workerId === worker.id)?.distanceKm ?? 0), 0)
  const project = (id: string) => db.projects.find((p) => p.id === id)
  const foreman = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'

  const choosePhoto = async (file?: File) => {
    if (file) api.workers.update(worker.id, { photo: await resizeImage(file) })
  }

  return (
    <div>
      <PageHeader
        title={worker.name}
        subtitle={<span className="flex flex-wrap items-center gap-2">{worker.skill} · Execution worker <Badge tone={worker.active ? 'green' : 'stone'}>{worker.active ? 'Active' : 'Inactive'}</Badge></span>}
        actions={<>
          {canEdit && (
            <>
              <button onClick={() => api.workers.update(worker.id, { active: !worker.active })} className="btn-secondary">
                {worker.active ? 'Mark inactive' : 'Mark active'}
              </button>
              <button onClick={() => setEditing(true)} className="btn-secondary"><Icon name="edit" className="h-4 w-4" /> Edit</button>
            </>
          )}
          {can('Employees', 'delete') && (
            <button onClick={() => setDeleting(true)} className="btn-danger"><Icon name="trash" className="h-4 w-4" /> Delete</button>
          )}
        </>}
      />

      {/* Profile card */}
      <div className="card mb-6 flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center gap-2">
          <Avatar name={worker.name} size="xl" src={worker.photo} />
          {canEdit && (
            <>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { choosePhoto(e.target.files?.[0]); e.target.value = '' }} />
              <button onClick={() => photoRef.current?.click()} className="text-xs font-semibold text-brand-700 hover:text-brand-800">
                {worker.photo ? 'Change photo' : 'Add photo'}
              </button>
            </>
          )}
        </div>
        <dl className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="label">Contact</dt>
            <dd className="mt-1 text-sm text-stone-800"><ContactNumbers phone={worker.phone} whatsapp={worker.whatsapp} /></dd>
          </div>
          <div>
            <dt className="label">Joined</dt>
            <dd className="mt-1 text-sm text-stone-800">
              {worker.joinedOn ? <>{formatDateLong(worker.joinedOn)} <span className="block text-xs text-stone-400">{span(worker.joinedOn, today())} with us</span></> : '—'}
            </dd>
          </div>
          <div>
            <dt className="label">Daily Wage</dt>
            <dd className="mt-1 text-sm font-semibold text-stone-800">{worker.dailyWage ? formatCurrency(worker.dailyWage) : '—'}</dd>
          </div>
          <div>
            <dt className="label">Today</dt>
            <dd className="mt-1 text-sm text-stone-800">
              {todayDay
                ? <>{todayDay.status}{todayDay.projectIds[0] && <> at <SiteName name={project(todayDay.projectIds[0])?.siteLocation ?? ''} /></>}</>
                : <span className="text-stone-400">Not on a report yet</span>}
            </dd>
          </div>
          {worker.address && (
            <div className="sm:col-span-2">
              <dt className="label">Address</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-stone-800">{worker.address}</dd>
            </div>
          )}
          {worker.emergencyContact && (
            <div className="sm:col-span-2">
              <dt className="label">Emergency Contact</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-stone-800">{worker.emergencyContact}</dd>
            </div>
          )}
          {worker.notes && (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="label">Notes</dt>
              <dd className="mt-1 text-sm text-stone-700">{worker.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      <Tabs<Tab>
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'attendance', label: 'Attendance' },
          ...(can('Accounts', 'view') || canEdit ? [{ key: 'payments' as Tab, label: 'Wages' }] : []),
          { key: 'history', label: 'Work History', count: history.length },
          { key: 'amc', label: 'AMC Visits', count: amcVisits.length },
        ]}
      />

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Days This Month" value={monthTotals.days} tone="green" icon="calendar" />
            <StatTile label="Overtime This Month" value={`${monthTotals.ot}h`} tone="blue" icon="clock" />
            <StatTile
              label="Earned This Month" tone="clay" icon="rupee"
              value={worker.dailyWage ? formatCurrency(monthTotals.days * worker.dailyWage, true) : '—'}
              sub={worker.dailyWage ? `${monthTotals.days} days × ${formatCurrency(worker.dailyWage)}` : 'Set a daily wage to see this'}
            />
            <StatTile label="TA Distance" value={`${totalKm} km`} sub="across all reports" icon="map" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            <Section title="Worked Under" description="The foremen whose reports this worker is on.">
              {foremen.length === 0 ? <EmptyState title="Not on any foreman’s report yet." icon="users" /> : (
                <ul className="divide-y divide-stone-100">
                  {foremen.map((f) => {
                    const person = db.employees.find((e) => e.id === f.foremanId)
                    return (
                      <li key={f.foremanId} className="flex items-center gap-3 px-5 py-3">
                        <Avatar name={person?.name ?? '?'} size="sm" src={person?.photo} />
                        <span className="min-w-0 flex-1">
                          <Link to={`/employees/${f.foremanId}`} className="block truncate text-sm font-medium text-stone-800 hover:text-brand-700">{person?.name ?? 'Former foreman'}</Link>
                          <span className="block text-xs text-stone-400">Last {formatDate(f.lastDate)}</span>
                        </span>
                        <button onClick={() => showHistoryFor(f.foremanId)} className="shrink-0 text-right" title="Show these reports">
                          <Badge tone="green">{f.days} day{f.days === 1 ? '' : 's'}</Badge>
                          <span className="mt-0.5 block text-[11px] font-semibold text-brand-700">Reports</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Section>
            <Section title="Sites — last 30 days">
              {sites.length === 0 ? <EmptyState title="Not on any site report in the last 30 days." icon="pin" /> : (
                <ul className="divide-y divide-stone-100">
                  {sites.map(([projectId, count]) => (
                    <li key={projectId}>
                      <Link to={`/projects/${projectId}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-stone-50">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-stone-800">{project(projectId)?.name}</span>
                          <span className="block truncate text-xs text-stone-400"><SiteName name={project(projectId)?.siteLocation ?? ''} /></span>
                        </span>
                        <Badge tone="green">{count} day{count === 1 ? '' : 's'}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Recent Work">
              {reports.length === 0 ? <EmptyState title="No reports yet." icon="doc" /> : (
                <ul className="divide-y divide-stone-100">
                  {reports.slice(0, 6).map((r) => (
                    <li key={r.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium tabular-nums text-stone-800">{formatDate(r.date)}</span>
                        <Link to={`/execution/reports/${r.id}`} className="text-xs font-semibold text-brand-700">Report</Link>
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500"><SiteName name={r.siteLocation} /> · {r.workDone.filter(Boolean).join('; ')}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      )}

      {tab === 'attendance' && <PersonAttendance kind="worker" personId={worker.id} canEdit={can('Attendance', 'edit')} />}
      {tab === 'payments' && <PersonPayments kind="worker" personId={worker.id} dailyWage={worker.dailyWage} canManage={can('Accounts', 'create') || canEdit} />}

      {tab === 'history' && (
        <Section
          title="Work History"
          description={foremanFilter
            ? `Reports where this worker was under ${foreman(foremanFilter)}.`
            : 'Every daily report this worker appears on.'}
          actions={foremen.length > 1 && (
            <select className="input w-full py-1.5 sm:w-56" value={foremanFilter} onChange={(e) => setForemanFilter(e.target.value)} aria-label="Foreman">
              <option value="">All foremen</option>
              {foremen.map((f) => <option key={f.foremanId} value={f.foremanId}>{foreman(f.foremanId)} · {f.days} day{f.days === 1 ? '' : 's'}</option>)}
            </select>
          )}
        >
          {history.length === 0 ? <EmptyState title="No reports yet." icon="doc" /> : (
            <Table head={['Date', 'Site', 'Foreman', 'In', 'Out', 'Work Done', 'TA', 'Report']}>
              {history.map((r) => {
                const entry = r.attendance.find((a) => a.workerId === worker.id)
                const km = r.ta.find((t) => t.workerId === worker.id)?.distanceKm
                return (
                  <tr key={r.id} className="row-hover">
                    <td className="td whitespace-nowrap font-medium tabular-nums text-stone-900">{formatDate(r.date)}</td>
                    <td className="td">
                      <Link to={`/projects/${r.projectId}`} className="hover:text-brand-700"><SiteName name={r.siteLocation} /></Link>
                    </td>
                    <td className="td">{foreman(r.foremanId)}</td>
                    <td className="td tabular-nums">{formatTime(entry?.checkIn || r.startTime)}</td>
                    <td className="td tabular-nums">{formatTime(entry?.checkOut || r.endTime)}</td>
                    <td className="td max-w-xs truncate" title={r.workDone.join('; ')}>{r.workDone.filter(Boolean).join('; ')}</td>
                    <td className="td tabular-nums">{km ? `${km} km` : '—'}</td>
                    <td className="td">
                      <Link to={`/execution/reports/${r.id}`}><StatusBadge status={r.status} /></Link>
                    </td>
                  </tr>
                )
              })}
            </Table>
          )}
        </Section>
      )}

      {tab === 'amc' && (
        <Section title="AMC Visits">
          {amcVisits.length === 0 ? <EmptyState title="Not on any AMC visit team." icon="leaf" /> : (
            <Table head={['Date', 'Project', 'Type', 'Notes', 'Status']}>
              {amcVisits.map(({ record, visit }) => (
                <tr key={visit.id} className="row-hover">
                  <td className="td font-medium tabular-nums text-stone-900">{formatDate(visit.date)}</td>
                  <td className="td">{project(record.projectId)?.name}</td>
                  <td className="td"><Badge tone="clay">{record.type}</Badge></td>
                  <td className="td max-w-sm">{visit.notes || '—'}</td>
                  <td className="td"><StatusBadge status={visit.done ? 'Completed' : 'Scheduled'} /></td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
      )}

      <Link to="/employees/workers" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <Icon name="back" className="h-4 w-4" /> All workers
      </Link>

      {editing && <WorkerFormModal worker={worker} onClose={() => setEditing(false)} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${worker.name}?`}
          onClose={() => setDeleting(false)}
          onConfirm={() => { api.workers.remove(worker.id); navigate('/employees/workers') }}
          message={reports.length > 0
            ? <>{worker.name} appears on {reports.length} daily report(s), which will no longer show their name. To keep the history, use <strong>Mark inactive</strong> instead.</>
            : <>This removes {worker.name} from the worker list.</>}
        />
      )}
    </div>
  )
}
