import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { computeProgress, projectType } from '../../domain/progress'
import { formatCurrency, formatDate, minutesBetween, pad2, today } from '../../domain/format'
import { PERIOD_LABELS, describeRange, inRange, rangeOf, type PeriodKey } from '../../domain/period'
import { allOccurrences } from '../../domain/amc'
import { receivable } from '../../domain/finance'
import { titleOf } from '../../domain/roles'
import { DESIGN_PHASES, PHASE_LABELS, type Lead, type Project, type ProjectStatus } from '../../domain/types'
import { PageHeader, Section, Table, StatTile, ProgressBar, Badge, EmptyState } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { RUPEES, excelDate, exportWorkbook, sheet } from '../../components/excel'

const PERIODS: PeriodKey[] = ['today', 'week', 'month', 'lastMonth', 'quarter', 'year', 'all', 'custom']
const STATUSES: ProjectStatus[] = ['Planning', 'In Progress', 'On Hold', 'Completed']
const SOURCES: Lead['source'][] = ['Instagram', 'Referral', 'Website', 'Walk-in', 'Google', 'Exhibition']

type Service = '' | 'design' | 'execution' | 'amc'

interface Filters {
  period: PeriodKey
  from: string
  to: string
  service: Service
  status: ProjectStatus | ''
  managerId: string
  clientId: string
  source: Lead['source'] | ''
}

const DEFAULTS: Filters = {
  period: 'year', from: `${today().slice(0, 7)}-01`, to: today(),
  service: '', status: '', managerId: '', clientId: '', source: '',
}

/**
 * Management reporting across the five systems — portfolio, money, pipeline,
 * site work, tasks and AMC — for any date range, narrowed by service, status,
 * manager, client and lead source, and exportable to Excel.
 */
export function ReportsPage() {
  const db = useDb()
  const [f, setF] = useState<Filters>(DEFAULTS)
  const [exporting, setExporting] = useState(false)
  const set = (patch: Partial<Filters>) => setF({ ...f, ...patch })

  const range = rangeOf(f.period, { from: f.from, to: f.to })
  const inPeriod = (d?: string) => inRange(d, range)

  // The project filters (everything except dates) decide which projects the rest of the report covers.
  const baseMatch = (p: Project) =>
    (!f.service || Boolean(p.services[f.service]))
    && (!f.status || p.status === f.status)
    && (!f.managerId || p.projectManagerId === f.managerId)
    && (!f.clientId || p.clientId === f.clientId)
  const scoped = useMemo(() => db.projects.filter(baseMatch), [db.projects, f])
  const scopedIds = new Set(scoped.map((p) => p.id))
  // Projects running at some point in the period.
  const active = scoped.filter((p) => !range || (p.startDate <= range.to && p.expectedCompletion >= range.from))
  const started = scoped.filter((p) => inPeriod(p.startDate))

  const payments = db.payments.filter((p) => scopedIds.has(p.projectId) && inPeriod(p.date)).sort((a, b) => b.date.localeCompare(a.date))
  const collected = payments.reduce((s, p) => s + p.amount, 0)
  const contracted = active.reduce((s, p) => s + p.value, 0)

  const leads = db.leads.filter((l) => inPeriod(l.createdAt) && (!f.source || l.source === f.source))
  const won = leads.filter((l) => l.status === 'Won')
  const leadsBySource = SOURCES.map((source) => {
    const ofSource = leads.filter((l) => l.source === source)
    return { source, total: ofSource.length, won: ofSource.filter((l) => l.status === 'Won').length, lost: ofSource.filter((l) => l.status === 'Lost').length }
  }).filter((r) => r.total > 0)

  const reports = db.reports.filter((r) => scopedIds.has(r.projectId) && inPeriod(r.date) && r.status !== 'Draft')
  const workerDays = reports.reduce((s, r) => s + r.attendance.filter((a) => a.present).length, 0)
  const tasks = db.tasks.filter((t) => scopedIds.has(t.projectId) && inPeriod(t.dueDate))
  const tasksDone = tasks.filter((t) => t.status === 'Done')
  const amc = allOccurrences(db.maintenance.filter((m) => scopedIds.has(m.projectId)), today()).filter((o) => inPeriod(o.date))

  const byType = [...new Set(active.map(projectType))].sort().map((type) => {
    const projects = active.filter((p) => projectType(p) === type)
    return {
      type, projects,
      value: projects.reduce((s, p) => s + p.value, 0),
      average: projects.length ? Math.round(projects.reduce((s, p) => s + computeProgress(p).overall, 0) / projects.length) : 0,
    }
  })

  const byClient = db.clients
    .map((c) => {
      const ids = new Set(scoped.filter((p) => p.clientId === c.id).map((p) => p.id))
      const paid = payments.filter((p) => ids.has(p.projectId)).reduce((s, p) => s + p.amount, 0)
      return { client: c, projects: ids.size, paid, outstanding: receivable(db, c.id).outstanding }
    })
    .filter((r) => r.projects > 0)
    .sort((a, b) => b.paid - a.paid)

  const foremen = db.employees.filter((e) => e.role === 'foreman').map((foreman) => {
    const mine = reports.filter((r) => r.foremanId === foreman.id)
    return {
      foreman, reports: mine.length,
      approved: mine.filter((r) => r.status === 'Approved').length,
      workerDays: mine.reduce((s, r) => s + r.attendance.filter((a) => a.present).length, 0),
      photos: mine.reduce((s, r) => s + r.photos.length, 0),
    }
  })

  const assignees = [...new Set(tasks.map((t) => t.assigneeId))].map((id) => {
    const theirs = tasks.filter((t) => t.assigneeId === id)
    return {
      person: db.employees.find((e) => e.id === id),
      total: theirs.length,
      done: theirs.filter((t) => t.status === 'Done').length,
      overdue: theirs.filter((t) => t.status !== 'Done' && t.dueDate < today()).length,
    }
  }).sort((a, b) => b.total - a.total)

  const projectName = (id: string) => db.projects.find((p) => p.id === id)?.name ?? ''
  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? ''
  const personName = (id?: string) => db.employees.find((e) => e.id === id)?.name ?? ''
  const filtersOn = f.service || f.status || f.managerId || f.clientId || f.source

  const exportExcel = async () => {
    setExporting(true)
    try {
      const filterNote = [
        `Period: ${PERIOD_LABELS[f.period]} (${describeRange(range)})`,
        f.service && `Service: ${f.service.toUpperCase()}`,
        f.status && `Status: ${f.status}`,
        f.managerId && `Manager: ${personName(f.managerId)}`,
        f.clientId && `Client: ${clientName(f.clientId)}`,
        f.source && `Lead source: ${f.source}`,
      ].filter(Boolean).join(' · ')
      await exportWorkbook(`Landschaft report ${today()}`, [
        sheet({
          name: 'Summary',
          rows: [
            ['Report', 'Landschaft CRM — management report'], ['Filters', filterNote], ['Generated', excelDate(today())],
            ['Projects running', active.length], ['Projects started', started.length], ['Contract value (running)', contracted],
            ['Collected', collected], ['New leads', leads.length], ['Leads won', won.length], ['Daily reports filed', reports.length],
            ['Worker-days on site', workerDays], ['Tasks due', tasks.length], ['Tasks done', tasksDone.length],
            ['AMC visits planned', amc.length], ['AMC visits done', amc.filter((o) => o.status === 'Done').length],
          ] as [string, unknown][],
          columns: [
            { header: 'Measure', value: (r: [string, unknown]) => r[0], width: 28 },
            { header: 'Value', value: (r: [string, unknown]) => r[1] as never, width: 60, format: RUPEES },
          ],
        }),
        sheet({
          name: 'Projects',
          rows: active,
          columns: [
            { header: 'Code', value: (p: Project) => p.code, width: 14 },
            { header: 'Project', value: (p: Project) => p.name, width: 34 },
            { header: 'Client', value: (p: Project) => clientName(p.clientId), width: 28 },
            { header: 'Type', value: (p: Project) => projectType(p), width: 24 },
            { header: 'Site', value: (p: Project) => p.siteLocation, width: 26 },
            { header: 'Manager', value: (p: Project) => personName(p.projectManagerId), width: 16 },
            { header: 'Status', value: (p: Project) => p.status, width: 13 },
            { header: 'Delayed', value: (p: Project) => p.delayed && p.status !== 'Completed', width: 9 },
            { header: 'Start', value: (p: Project) => excelDate(p.startDate), width: 12 },
            { header: 'Due', value: (p: Project) => excelDate(p.expectedCompletion), width: 12 },
            { header: 'Progress %', value: (p: Project) => computeProgress(p).overall, width: 11 },
            { header: 'Value (₹)', value: (p: Project) => p.value, width: 14, format: RUPEES },
            { header: 'Received (₹)', value: (p: Project) => db.payments.filter((x) => x.projectId === p.id).reduce((s, x) => s + x.amount, 0), width: 14, format: RUPEES },
          ],
        }),
        sheet({
          name: 'Payments',
          rows: payments,
          columns: [
            { header: 'Date', value: (p) => excelDate(p.date), width: 12 },
            { header: 'Client', value: (p) => clientName(p.clientId), width: 28 },
            { header: 'Project', value: (p) => projectName(p.projectId), width: 32 },
            { header: 'Amount (₹)', value: (p) => p.amount, width: 14, format: RUPEES },
            { header: 'Method', value: (p) => p.method, width: 15 },
            { header: 'Reference', value: (p) => p.reference, width: 22 },
          ],
        }),
        sheet({
          name: 'Leads',
          rows: leads,
          columns: [
            { header: 'Created', value: (l: Lead) => excelDate(l.createdAt), width: 12 },
            { header: 'Name', value: (l: Lead) => l.name, width: 26 },
            { header: 'Phone', value: (l: Lead) => l.phone, width: 18 },
            { header: 'WhatsApp', value: (l: Lead) => l.whatsapp || l.phone, width: 18 },
            { header: 'Location', value: (l: Lead) => l.location, width: 18 },
            { header: 'Source', value: (l: Lead) => l.source, width: 12 },
            { header: 'Status', value: (l: Lead) => l.status, width: 12 },
            { header: 'Owner', value: (l: Lead) => personName(l.ownerId), width: 14 },
            { header: 'Requirement', value: (l: Lead) => l.requirement, width: 44 },
          ],
        }),
        sheet({
          name: 'Daily Reports',
          rows: reports,
          columns: [
            { header: 'Date', value: (r) => excelDate(r.date), width: 12 },
            { header: 'Project', value: (r) => projectName(r.projectId), width: 30 },
            { header: 'Site', value: (r) => r.siteLocation, width: 24 },
            { header: 'Foreman', value: (r) => personName(r.foremanId), width: 14 },
            { header: 'Workers', value: (r) => r.attendance.filter((a) => a.present).length, width: 10 },
            { header: 'Hours', value: (r) => Math.round(minutesBetween(r.startTime, r.endTime) / 6) / 10, width: 8 },
            { header: 'OT hours', value: (r) => r.otHours, width: 9 },
            { header: 'Photos', value: (r) => r.photos.length, width: 8 },
            { header: 'Status', value: (r) => r.status, width: 11 },
            { header: 'Work done', value: (r) => r.workDone.filter(Boolean).join('; '), width: 60 },
            { header: 'Issues', value: (r) => r.issues.filter((i) => i && i.toLowerCase() !== 'nothing').join('; '), width: 40 },
          ],
        }),
        sheet({
          name: 'Tasks',
          rows: tasks,
          columns: [
            { header: 'Due', value: (t) => excelDate(t.dueDate), width: 12 },
            { header: 'Task', value: (t) => t.title, width: 44 },
            { header: 'Project', value: (t) => projectName(t.projectId), width: 30 },
            { header: 'Phase', value: (t) => (t.phase ? PHASE_LABELS[t.phase] : ''), width: 16 },
            { header: 'Assignee', value: (t) => personName(t.assigneeId), width: 16 },
            { header: 'Priority', value: (t) => t.priority, width: 10 },
            { header: 'Status', value: (t) => t.status, width: 12 },
          ],
        }),
        sheet({
          name: 'AMC Visits',
          rows: amc,
          columns: [
            { header: 'Date', value: (o) => excelDate(o.date), width: 12 },
            { header: 'Project', value: (o) => projectName(o.record.projectId), width: 32 },
            { header: 'Contract', value: (o) => o.record.type, width: 16 },
            { header: 'Status', value: (o) => o.status, width: 11 },
            { header: 'Team', value: (o) => (o.visit?.teamIds ?? o.record.teamIds).map((id) => db.workers.find((w) => w.id === id)?.name).filter(Boolean).join(', '), width: 26 },
            { header: 'Notes', value: (o) => o.visit?.notes ?? '', width: 44 },
          ],
        }),
        sheet({
          name: 'Foremen',
          rows: foremen,
          columns: [
            { header: 'Foreman', value: (r) => r.foreman.name, width: 16 },
            { header: 'Reports', value: (r) => r.reports, width: 10 },
            { header: 'Approved', value: (r) => r.approved, width: 10 },
            { header: 'Worker-days', value: (r) => r.workerDays, width: 12 },
            { header: 'Photos', value: (r) => r.photos, width: 10 },
          ],
        }),
      ])
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Portfolio, money, pipeline, site work, tasks and AMC — for any period, filtered as you need, and exportable to Excel."
        actions={
          <button onClick={exportExcel} disabled={exporting} className="btn-primary">
            <Icon name="upload" className="h-4 w-4 rotate-180" /> {exporting ? 'Preparing…' : 'Export to Excel'}
          </button>
        }
      />

      {/* Filters */}
      <div className="card mb-6 space-y-3 p-4">
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => set({ period: p })}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${f.period === p ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {f.period === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" className="input w-auto py-1.5" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label="From" />
              <span className="text-sm text-stone-400">to</span>
              <input type="date" className="input w-auto py-1.5" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label="To" />
            </div>
          )}
          <select className="input py-1.5 sm:w-40" value={f.service} onChange={(e) => set({ service: e.target.value as Service })} aria-label="Service">
            <option value="">All services</option>
            <option value="design">Design</option>
            <option value="execution">Execution</option>
            <option value="amc">AMC</option>
          </select>
          <select className="input py-1.5 sm:w-40" value={f.status} onChange={(e) => set({ status: e.target.value as ProjectStatus | '' })} aria-label="Project status">
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input py-1.5 sm:w-44" value={f.managerId} onChange={(e) => set({ managerId: e.target.value })} aria-label="Project manager">
            <option value="">All managers</option>
            {db.employees.filter((e) => db.projects.some((p) => p.projectManagerId === e.id)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select className="input py-1.5 sm:w-52" value={f.clientId} onChange={(e) => set({ clientId: e.target.value })} aria-label="Client">
            <option value="">All clients</option>
            {db.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input py-1.5 sm:w-40" value={f.source} onChange={(e) => set({ source: e.target.value as Lead['source'] | '' })} aria-label="Lead source">
            <option value="">All lead sources</option>
            {SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <span className="text-xs text-stone-500 sm:ml-auto">{describeRange(range)}</span>
          {(filtersOn || f.period !== DEFAULTS.period) && (
            <button onClick={() => setF(DEFAULTS)} className="text-xs font-semibold text-brand-700">Clear filters</button>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
        <StatTile label="Projects Running" value={pad2(active.length)} sub={`${started.length} started`} icon="folder" />
        <StatTile label="Contract Value" value={formatCurrency(contracted, true)} sub="of running projects" icon="doc" />
        <StatTile label="Collected" value={formatCurrency(collected, true)} sub={`${payments.length} payments`} tone="green" icon="rupee" />
        <StatTile label="New Leads" value={pad2(leads.length)} sub={`${won.length} won`} tone="blue" icon="users" />
        <StatTile label="Worker-Days" value={workerDays} sub={`${reports.length} site reports`} tone="clay" icon="hardhat" />
        <StatTile label="Tasks Done" value={`${tasksDone.length}/${tasks.length}`} sub="due in the period" tone="violet" icon="check" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Portfolio by Project Type" description="Projects running in the period">
          {byType.length === 0 ? <EmptyState title="No projects in this period." icon="folder" /> : (
            <Table head={['Type', 'Projects', 'Value', 'Average Progress']}>
              {byType.map(({ type, projects, value, average }) => (
                <tr key={type} className="row-hover">
                  <td className="td font-medium text-stone-900">{type}</td>
                  <td className="td tabular-nums">{projects.length}</td>
                  <td className="td tabular-nums">{formatCurrency(value, true)}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-24"><ProgressBar value={average} size="sm" /></div>
                      <span className="w-9 text-right text-xs font-semibold tabular-nums">{average}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        <Section title="Collections by Client" description="Paid in the period, and what is still owed">
          {byClient.length === 0 ? <EmptyState title="No clients in scope." icon="users" /> : (
            <Table head={['Client', 'Projects', 'Paid in period', 'Outstanding']}>
              {byClient.map(({ client, projects, paid, outstanding }) => (
                <tr key={client.id} className="row-hover">
                  <td className="td font-medium text-stone-900"><Link to={`/crm/clients/${client.id}`} className="hover:text-brand-700">{client.name}</Link></td>
                  <td className="td tabular-nums">{projects}</td>
                  <td className="td font-semibold tabular-nums text-brand-700">{paid ? formatCurrency(paid) : '—'}</td>
                  <td className="td tabular-nums">{outstanding ? <span className="text-amber-700">{formatCurrency(outstanding)}</span> : '—'}</td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        <Section title="Lead Sources" description="Leads that came in during the period">
          {leadsBySource.length === 0 ? <EmptyState title="No new leads in this period." icon="users" /> : (
            <Table head={['Source', 'Leads', 'Won', 'Lost', 'Conversion']}>
              {leadsBySource.map((r) => (
                <tr key={r.source} className="row-hover">
                  <td className="td font-medium text-stone-900">{r.source}</td>
                  <td className="td tabular-nums">{r.total}</td>
                  <td className="td tabular-nums">{r.won}</td>
                  <td className="td tabular-nums">{r.lost}</td>
                  <td className="td"><Badge tone={r.won ? 'green' : 'stone'}>{Math.round((r.won / r.total) * 100)}%</Badge></td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        <Section title="Foreman Reporting" description="Daily reports filed in the period">
          <Table head={['Foreman', 'Reports', 'Approved', 'Worker-Days', 'Photos']}>
            {foremen.map((r) => (
              <tr key={r.foreman.id} className="row-hover">
                <td className="td font-medium text-stone-900">{r.foreman.name}</td>
                <td className="td tabular-nums">{r.reports}</td>
                <td className="td tabular-nums">{r.approved}</td>
                <td className="td tabular-nums">{r.workerDays}</td>
                <td className="td tabular-nums">{r.photos}</td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section title="Tasks by Person" description="Tasks falling due in the period">
          {assignees.length === 0 ? <EmptyState title="No tasks due in this period." icon="check" /> : (
            <Table head={['Person', 'Due', 'Done', 'Overdue', 'Completion']}>
              {assignees.map((r) => (
                <tr key={r.person?.id ?? 'none'} className="row-hover">
                  <td className="td">
                    <span className="font-medium text-stone-900">{r.person?.name ?? 'Unassigned'}</span>
                    {r.person && <span className="block text-xs text-stone-400">{titleOf(r.person)}</span>}
                  </td>
                  <td className="td tabular-nums">{r.total}</td>
                  <td className="td tabular-nums">{r.done}</td>
                  <td className="td tabular-nums">{r.overdue ? <Badge tone="red">{r.overdue}</Badge> : '—'}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-20"><ProgressBar value={(r.done / r.total) * 100} size="sm" /></div>
                      <span className="text-xs font-semibold tabular-nums">{Math.round((r.done / r.total) * 100)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        <Section title="AMC Visits" description="Planned and done in the period">
          {amc.length === 0 ? <EmptyState title="No AMC visits in this period." icon="leaf" /> : (
            <Table head={['Project', 'Planned', 'Done', 'Overdue']}>
              {[...new Set(amc.map((o) => o.record.projectId))].map((pid) => {
                const ofProject = amc.filter((o) => o.record.projectId === pid)
                return (
                  <tr key={pid} className="row-hover">
                    <td className="td font-medium text-stone-900">{projectName(pid)}</td>
                    <td className="td tabular-nums">{ofProject.length}</td>
                    <td className="td tabular-nums">{ofProject.filter((o) => o.status === 'Done').length}</td>
                    <td className="td tabular-nums">{ofProject.filter((o) => o.status === 'Overdue').length || '—'}</td>
                  </tr>
                )
              })}
            </Table>
          )}
        </Section>

        <Section title="Design Phase Throughput" description="Projects in scope carrying each phase" className="xl:col-span-2">
          <Table head={['Phase', 'Projects', 'Complete', 'Average']}>
            {DESIGN_PHASES.map((key) => {
              const projects = active.filter((p) => p.services.design && p.design[key].enabled)
              const complete = projects.filter((p) => p.design[key].progress === 100).length
              const average = projects.length ? Math.round(projects.reduce((s, p) => s + p.design[key].progress, 0) / projects.length) : 0
              return (
                <tr key={key} className="row-hover">
                  <td className="td font-medium text-stone-900">{PHASE_LABELS[key]}</td>
                  <td className="td tabular-nums">{projects.length}</td>
                  <td className="td tabular-nums">{complete}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-24"><ProgressBar value={average} size="sm" /></div>
                      <span className="w-9 text-right text-xs font-semibold tabular-nums">{average}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </Table>
        </Section>
      </div>

      <p className="mt-6 text-xs text-stone-400">
        Export includes every sheet above with the same filters — Summary, Projects, Payments, Leads, Daily Reports, Tasks, AMC Visits and Foremen. Report run {formatDate(today())}.
      </p>
    </div>
  )
}
