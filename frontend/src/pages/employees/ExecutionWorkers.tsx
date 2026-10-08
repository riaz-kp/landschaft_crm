import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { usePermissions } from '../../state/permissions'
import { formatCurrency, today } from '../../domain/format'
import { daysOfMonth, indexRegister, indexWorkerReports, resolveDay, totalsFor } from '../../domain/attendance'
import type { Worker } from '../../domain/types'
import {
  PageHeader, Section, Table, Badge, StatTile, Avatar, Pills, SearchInput, Toolbar, RowActions,
  ConfirmDialog, EmptyState, SiteName,
} from '../../components/ui'
import { ContactNumbers } from '../../components/ContactFields'
import { Icon } from '../../components/Icon'
import { WorkerFormModal } from './WorkerForm'

type Filter = 'active' | 'inactive' | 'all'

/** Site labour. Workers are recorded by foremen and have no login. */
export function ExecutionWorkers() {
  const db = useDb()
  const { can } = usePermissions()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('active')
  const [skill, setSkill] = useState('')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Worker | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Worker | null>(null)

  const register = useMemo(() => indexRegister(db.attendance), [db.attendance])
  const workerReports = useMemo(() => indexWorkerReports(db.reports), [db.reports])
  const month = today().slice(0, 7)
  const monthDays = daysOfMonth(month).filter((d) => d <= today())

  const todayFor = (id: string) => resolveDay('worker', id, today(), register, workerReports)
  const monthTotals = (id: string) =>
    totalsFor(monthDays.map((date) => ({ date, day: resolveDay('worker', id, date, register, workerReports) })), db.settings.holidays)
  const siteName = (projectId: string) => db.projects.find((p) => p.id === projectId)?.siteLocation ?? ''

  const skills = [...new Set(db.workers.map((w) => w.skill))].sort()
  const q = query.trim().toLowerCase()
  const workers = db.workers.filter((w) =>
    (filter === 'all' || (filter === 'active' ? w.active : !w.active))
    && (!skill || w.skill === skill)
    && (!q || [w.name, w.skill, w.phone].some((v) => v.toLowerCase().includes(q))))

  const active = db.workers.filter((w) => w.active)
  const onSiteToday = active.filter((w) => todayFor(w.id)?.status === 'Present' || todayFor(w.id)?.status === 'Half Day')
  const reportCount = (id: string) => db.reports.filter((r) => r.attendance.some((a) => a.workerId === id && a.present)).length

  return (
    <div>
      <PageHeader
        title="Execution Workers"
        subtitle="Site labour. Workers do not log in — foremen record them on the daily report. Open a worker for their attendance, sites and work history."
        actions={can('Employees', 'create') && (
          <button onClick={() => setEditing('new')} className="btn-primary">
            <Icon name="plus" className="h-4 w-4" /> Add worker
          </button>
        )}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total Workers" value={db.workers.length} icon="hardhat" />
        <StatTile label="Active" value={active.length} tone="green" icon="check" />
        <StatTile label="On Site Today" value={onSiteToday.length} tone="amber" icon="pin" to="/employees/attendance" />
        <StatTile
          label="Daily Wage Bill" tone="clay" icon="rupee"
          value={formatCurrency(onSiteToday.reduce((s, w) => s + (w.dailyWage ?? 0), 0), true)}
          sub="for those on site today"
        />
      </div>

      <Toolbar>
        <Pills<Filter>
          active={filter}
          onChange={setFilter}
          options={[
            { key: 'active', label: 'Active', count: active.length },
            { key: 'inactive', label: 'Inactive', count: db.workers.length - active.length },
            { key: 'all', label: 'All', count: db.workers.length },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <select className="input sm:w-52" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Skill">
            <option value="">All skills</option>
            {skills.map((s) => <option key={s}>{s}</option>)}
          </select>
          <SearchInput value={query} onChange={setQuery} placeholder="Search workers…" className="sm:w-64" />
        </div>
      </Toolbar>

      <Section>
        {workers.length === 0 ? (
          <EmptyState title="No workers match these filters." icon="hardhat" />
        ) : (
          <Table head={['Worker', 'Skill', 'Phone', 'Today', 'This Month', 'Day Rate', 'Status', '']}>
            {workers.map((worker) => {
              const day = todayFor(worker.id)
              const t = monthTotals(worker.id)
              return (
                <tr key={worker.id} className="row-hover">
                  <td className="td">
                    <Link to={`/employees/workers/${worker.id}`} className="flex items-center gap-2.5">
                      <Avatar name={worker.name} size="sm" src={worker.photo} />
                      <span className="font-medium text-stone-900 hover:text-brand-700">{worker.name}</span>
                    </Link>
                  </td>
                  <td className="td">{worker.skill}</td>
                  <td className="td"><ContactNumbers phone={worker.phone} whatsapp={worker.whatsapp} /></td>
                  <td className="td">
                    {day?.projectIds.length
                      ? <Badge tone="green"><SiteName name={siteName(day.projectIds[0])} /></Badge>
                      : day ? <Badge tone={day.status === 'Leave' ? 'violet' : day.status === 'Absent' ? 'red' : 'green'}>{day.status}</Badge>
                      : <span className="text-stone-400">—</span>}
                  </td>
                  <td className="td tabular-nums">
                    <span className="font-semibold text-stone-800">{t.days}</span>
                    <span className="text-stone-400"> days</span>
                    {t.ot > 0 && <span className="ml-1 text-xs text-sky-700">+{t.ot}h OT</span>}
                  </td>
                  <td className="td tabular-nums">{worker.dailyWage ? formatCurrency(worker.dailyWage) : '—'}</td>
                  <td className="td">
                    <Badge tone={worker.active ? 'green' : 'stone'}>{worker.active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="td">
                    <RowActions
                      onEdit={can('Employees', 'edit') ? () => setEditing(worker) : undefined}
                      onDelete={can('Employees', 'delete') ? () => setDeleting(worker) : undefined}
                    />
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Section>

      {editing && (
        <WorkerFormModal
          worker={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => editing === 'new' && navigate(`/employees/workers/${saved.id}`)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          onClose={() => setDeleting(null)}
          onConfirm={() => api.workers.remove(deleting.id)}
          message={reportCount(deleting.id) > 0
            ? <>{deleting.name} appears on {reportCount(deleting.id)} daily report(s). Deleting removes them from the list, but those reports will no longer show their name. To keep the history readable, edit them and untick <strong>Active</strong> instead.</>
            : <>This removes {deleting.name} from the worker list.</>}
        />
      )}
    </div>
  )
}
