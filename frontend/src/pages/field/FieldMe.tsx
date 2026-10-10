import { useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { titleOf } from '../../domain/roles'
import { formatCurrency, formatDate, formatDateLong, today, whatsappUrl } from '../../domain/format'
import { PAY_TONE } from '../../domain/pay'
import { BLOOD_GROUPS } from '../../domain/types'
import { Avatar, Badge, Field, FormError, SiteName } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { PhoneWhatsAppFields } from '../../components/ContactFields'
import { ProjectChat } from '../../components/ProjectChat'
import { resizeImage } from '../../components/imageResize'
import { PersonAttendance } from '../employees/EmployeeAttendance'
import { monthLabel, useMonthPay } from '../employees/PersonPayments'
import { FieldCard } from '../../shells/FieldShell'
import { FieldCrewAttendance } from './FieldCrewAttendance'

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ---------------------------------------------------------------- attendance

/**
 * Attendance on the foreman's phone: the workers under them, day by day, and
 * their own month. Both read-only — the office marks the register.
 */
export function FieldAttendance() {
  const { user } = useSession()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'me' ? 'me' : 'crew'

  return (
    <div>
      <h1 className="text-xl font-bold text-stone-900">Attendance</h1>
      <p className="mt-1 text-sm text-stone-500">
        {view === 'crew'
          ? 'Who was on site each day among the workers under you.'
          : 'Your own days, marked by the office. Speak to your Execution PM if a day looks wrong.'}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-stone-200/60 p-1">
        {([['crew', 'My workers', 'users'], ['me', 'My attendance', 'user']] as const).map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setParams(key === 'crew' ? {} : { view: key }, { replace: true })}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition ${
              view === key ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-500'
            }`}
          >
            <Icon name={icon} className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {view === 'crew' ? <FieldCrewAttendance /> : <PersonAttendance kind="employee" personId={user.id} canEdit={false} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- pay

/** The foreman's pay: this month so far, and every salary, advance and TA payment. */
export function FieldPay() {
  const db = useDb()
  const { user } = useSession()
  const [month, setMonth] = useState(today().slice(0, 7))
  const s = useMonthPay('employee', user.id, month, { monthlySalary: user.monthlySalary })
  const records = db.payRecords
    .filter((r) => r.kind === 'employee' && r.personId === user.id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const lastSalary = records.find((r) => r.type === 'Salary')

  return (
    <div>
      <h1 className="text-xl font-bold text-stone-900">My Pay</h1>
      <p className="mt-1 text-sm text-stone-500">Salary, advances and TA paid to you.</p>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-1.5 shadow-card">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="btn-icon h-10 w-10" aria-label="Previous month"><Icon name="chevron" className="h-4 w-4 rotate-180" /></button>
        <span className="font-semibold text-stone-900">{monthLabel(month)}</span>
        <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= today().slice(0, 7)} className="btn-icon h-10 w-10 disabled:opacity-30" aria-label="Next month"><Icon name="chevron" className="h-4 w-4" /></button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-white shadow-lift">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-200">{month === today().slice(0, 7) ? 'Earned so far' : 'Earned'}</p>
        <p className="mt-1 font-display text-4xl font-bold tabular-nums">{formatCurrency(s.earned)}</p>
        <p className="mt-1 text-xs text-brand-200">{s.basis}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/15 pt-4 text-center">
          <div>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(s.paid, true)}</p>
            <p className="text-[10px] uppercase tracking-wide text-brand-200">Salary paid</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(s.advances, true)}</p>
            <p className="text-[10px] uppercase tracking-wide text-brand-200">Advances</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-[#e9dcc8]">{formatCurrency(Math.max(0, s.balance), true)}</p>
            <p className="text-[10px] uppercase tracking-wide text-brand-200">Balance due</p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Days worked</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-stone-900">{s.daysWorked} <span className="text-sm font-normal text-stone-400">/ {s.workingDays}</span></p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">TA &amp; bonus</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-stone-900">{formatCurrency(s.ta + s.bonus)}</p>
        </div>
      </div>
      {lastSalary && (
        <p className="mt-3 text-center text-xs text-stone-500">
          Last salary {formatCurrency(lastSalary.amount)} on {formatDateLong(lastSalary.date)} · {lastSalary.method}
        </p>
      )}

      <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wider text-stone-500">Payments</h2>
      <div className="space-y-2">
        {records.map((r) => (
          <FieldCard key={r.id} className="flex items-center gap-3 py-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${r.type === 'Deduction' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'}`}>
              <Icon name={r.type === 'Advance' ? 'wallet' : r.type === 'TA' ? 'map' : 'rupee'} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                {r.type}{r.period && r.type === 'Salary' ? ` — ${monthLabel(r.period)}` : ''}
              </p>
              <p className="truncate text-xs text-stone-500">{formatDate(r.date)} · {r.method}{r.note ? ` · ${r.note}` : ''}</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold tabular-nums ${r.type === 'Deduction' ? 'text-red-700' : 'text-stone-900'}`}>{r.type === 'Deduction' ? '−' : ''}{formatCurrency(r.amount)}</p>
              <Badge tone={PAY_TONE[r.type]}>{r.type}</Badge>
            </div>
          </FieldCard>
        ))}
        {records.length === 0 && <FieldCard><p className="py-6 text-center text-sm text-stone-400">No payments recorded yet.</p></FieldCard>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- profile

/** The foreman's own profile — contact details they can keep up to date, and who they report to. */
export function FieldProfile() {
  const db = useDb()
  const { user } = useSession()
  const [editing, setEditing] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)
  const manager = db.employees.find((e) => e.id === user.reportsTo)
  const sites = db.siteAssignments
    .filter((a) => a.foremanId === user.id)
    .map((a) => db.projects.find((p) => p.id === a.projectId))
    .filter((p) => p && p.status !== 'Completed')

  const choosePhoto = async (file?: File) => {
    if (file) api.employees.update(user.id, { photo: await resizeImage(file) })
  }

  return (
    <div className="space-y-4">
      <FieldCard className="flex flex-col items-center py-6 text-center">
        <div className="relative">
          <Avatar name={user.name} size="xl" src={user.photo} />
          <input ref={photoRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => { choosePhoto(e.target.files?.[0]); e.target.value = '' }} />
          <button onClick={() => photoRef.current?.click()} className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow-md" aria-label="Change photo">
            <Icon name="camera" className="h-4 w-4" />
          </button>
        </div>
        <h1 className="mt-3 text-xl font-bold text-stone-900">{user.name}</h1>
        <p className="text-sm text-stone-500">{titleOf(user)} · {user.department}</p>
        {user.joinedOn && <p className="mt-1 text-xs text-stone-400">With Landschaft since {formatDateLong(user.joinedOn)}</p>}
      </FieldCard>

      {editing ? (
        <ProfileEdit onDone={() => setEditing(false)} />
      ) : (
        <FieldCard>
          <div className="mb-3 flex items-center justify-between">
            <p className="label">My details</p>
            <button onClick={() => setEditing(true)} className="text-sm font-semibold text-brand-700">Edit</button>
          </div>
          <dl className="space-y-3 text-sm">
            {[
              ['Mobile', user.phone],
              ['WhatsApp', user.whatsapp || user.phone],
              ['Email', user.email],
              ['Address', user.address],
              ['Date of birth', user.dob ? formatDateLong(user.dob) : undefined],
              ['Blood group', user.bloodGroup],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-stone-500">{label}</dt>
                <dd className={`text-right ${value ? 'font-medium text-stone-800' : 'text-stone-400'}`}>{value || 'Not recorded'}</dd>
              </div>
            ))}
          </dl>
        </FieldCard>
      )}

      {manager && (
        <FieldCard>
          <p className="label mb-3">I report to</p>
          <div className="flex items-center gap-3">
            <Avatar name={manager.name} src={manager.photo} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-stone-900">{manager.name}</p>
              <p className="truncate text-xs text-stone-500">{titleOf(manager)}</p>
            </div>
            <a href={`tel:${manager.phone.replace(/\s/g, '')}`} className="btn-secondary h-10 w-10 p-0" aria-label={`Call ${manager.name}`}><Icon name="phone" className="h-4 w-4" /></a>
            <a href={whatsappUrl(manager.whatsapp || manager.phone)} target="_blank" rel="noreferrer" className="btn-secondary h-10 w-10 p-0" aria-label={`WhatsApp ${manager.name}`}><Icon name="chat" className="h-4 w-4 text-brand-600" /></a>
          </div>
        </FieldCard>
      )}

      <FieldCard>
        <p className="label mb-2">My sites</p>
        <ul className="divide-y divide-stone-100">
          {sites.map((p) => p && (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span><SiteName name={p.siteLocation} /> <span className="text-stone-400">· {p.name}</span></span>
              <Link to={`/field/chat/${p.id}`} className="text-xs font-semibold text-brand-700">Remarks</Link>
            </li>
          ))}
          {sites.length === 0 && <li className="py-2 text-sm text-stone-400">No sites assigned.</li>}
        </ul>
      </FieldCard>
    </div>
  )
}

function ProfileEdit({ onDone }: { onDone: () => void }) {
  const { user } = useSession()
  const [form, setForm] = useState({
    phone: user.phone, whatsapp: user.whatsapp ?? '', address: user.address ?? '', dob: user.dob ?? '', bloodGroup: user.bloodGroup ?? '',
  })
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    if (!form.phone.trim()) return setError('Your mobile number is needed.')
    api.employees.update(user.id, {
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim() || form.phone.trim(),
      address: form.address.trim() || undefined,
      dob: form.dob || undefined,
      bloodGroup: form.bloodGroup || undefined,
    })
    onDone()
  }

  return (
    <FieldCard className="space-y-4">
      <p className="label">Edit my details</p>
      <PhoneWhatsAppFields required phone={form.phone} whatsapp={form.whatsapp} onChange={(n) => setForm({ ...form, ...n })} />
      <Field label="Address">
        <textarea rows={2} className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date of birth">
          <input type="date" className="input" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
        </Field>
        <Field label="Blood group">
          <select className="input" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
            <option value="">Select…</option>
            {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
          </select>
        </Field>
      </div>
      <FormError message={error} />
      <div className="flex gap-2">
        <button onClick={onDone} className="btn-secondary flex-1">Cancel</button>
        <button onClick={save} className="btn-primary flex-1">Save</button>
      </div>
    </FieldCard>
  )
}

// ---------------------------------------------------------------- remarks

/** A site's remarks thread, full screen on the phone. Only the foreman's own sites open. */
export function FieldChat() {
  const { projectId = '' } = useParams()
  const db = useDb()
  const { user } = useSession()
  const navigate = useNavigate()
  const assigned = db.siteAssignments.some((a) => a.foremanId === user.id && a.projectId === projectId)
  const project = db.projects.find((p) => p.id === projectId)

  if (!assigned || !project) {
    return <p className="text-sm text-stone-500">This site is not assigned to you.</p>
  }

  return (
    <div>
      <button onClick={() => navigate('/field')} className="mb-3 flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <Icon name="back" className="h-4 w-4" /> My Sites · <SiteName name={project.siteLocation} />
      </button>
      <ProjectChat projectId={projectId} height="h-[calc(100dvh-150px)]" />
    </div>
  )
}
