import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { computeProgress } from '../../domain/progress'
import { receivable } from '../../domain/finance'
import { partyName } from '../../domain/consultations'
import { inRange, periodPhrase } from '../../domain/period'
import { PeriodSwitch, useDashboardPeriod } from '../../components/PeriodSwitch'
import { allOccurrences, renewalReminders } from '../../domain/amc'
import { formatCurrency, formatDate, formatTime, pad2, today } from '../../domain/format'
import { DESIGN_PHASES, type Employee } from '../../domain/types'
import {
  PageHeader, Section, StatTile, StatusBadge, EmptyState, Badge, ProgressBar, Avatar, SiteName,
} from '../../components/ui'
import { Icon } from '../../components/Icon'

type Accent = 'design' | 'execution' | 'amc'

const ACCENTS: Record<Accent, { bar: string; chip: string; link: string }> = {
  design: { bar: 'border-t-sky-500', chip: 'bg-sky-100 text-sky-700', link: 'text-sky-700' },
  execution: { bar: 'border-t-brand-600', chip: 'bg-brand-100 text-brand-700', link: 'text-brand-700' },
  amc: { bar: 'border-t-clay-500', chip: 'bg-clay-100 text-clay-700', link: 'text-clay-700' },
}

type Metric = { label: string; value: ReactNode; alert?: boolean; to?: string }

/** One department at a glance — the CEO sees Design, Execution and AMC side by side. */
function DepartmentBox({
  title, icon, accent, head, to, linkLabel, metrics, listTitle, children,
}: {
  title: string; icon: string; accent: Accent; head?: Employee; to: string; linkLabel: string
  metrics: Metric[]; listTitle: string; children: ReactNode
}) {
  const a = ACCENTS[accent]
  return (
    <section className={`card flex min-w-0 flex-col border-t-4 ${a.bar}`}>
      <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.chip}`}>
            <Icon name={icon} className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-stone-900">{title}</h2>
            {head && <p className="text-xs text-stone-500">Led by {head.name}</p>}
          </div>
        </div>
        {head && (
          <Link to={`/employees/${head.id}`} title={head.name}>
            <Avatar name={head.name} size="sm" src={head.photo} />
          </Link>
        )}
      </header>

      <div className="grid grid-cols-2 border-y border-stone-100">
        {metrics.map((m, i) => {
          const body = (
            <div className={`h-full px-5 py-3 ${i % 2 === 0 ? 'border-r border-stone-100' : ''} ${i >= 2 ? 'border-t border-stone-100' : ''} ${m.to ? 'hover:bg-stone-50' : ''}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{m.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${m.alert ? 'text-red-700' : 'text-stone-900'}`}>{m.value}</p>
            </div>
          )
          return m.to ? <Link key={m.label} to={m.to}>{body}</Link> : <div key={m.label}>{body}</div>
        })}
      </div>

      <div className="flex-1 px-5 py-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-400">{listTitle}</p>
        {children}
      </div>

      <Link to={to} className={`flex items-center justify-between border-t border-stone-100 px-5 py-3 text-sm font-semibold ${a.link} hover:bg-stone-50`}>
        {linkLabel} <Icon name="chevron" className="h-4 w-4" />
      </Link>
    </section>
  )
}

/** CEO / Super Admin view — the company as three departments, plus money and the CEO's own diary. */
export function OverviewDashboard() {
  const db = useDb()
  const { user } = useSession()
  const date = today()

  const headOf = (role: Employee['role']) => db.employees.find((e) => e.role === role)
  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'

  const { period, range } = useDashboardPeriod()
  const when = periodPhrase(period)
  const inPeriod = (d?: string) => inRange(d, range)

  // ------------------------------------------------ company
  const openLeads = db.leads.filter((l) => !['Won', 'Lost'].includes(l.status))
  const newLeads = db.leads.filter((l) => inPeriod(l.createdAt))
  const started = db.projects.filter((p) => inPeriod(p.startDate))
  const newBusiness = started.reduce((sum, p) => sum + p.value, 0)
  const paymentsIn = db.payments.filter((p) => inPeriod(p.date))
  const received = paymentsIn.reduce((sum, p) => sum + p.amount, 0)
  const owed = db.clients.reduce((sum, c) => sum + receivable(db, c.id).outstanding, 0)
  const pendingRequests = db.paymentRequests.filter((r) => r.status === 'Pending')

  // ------------------------------------------------ design
  const designProjects = db.projects.filter((p) => p.services.design && p.status !== 'Completed')
  const designIds = new Set(designProjects.map((p) => p.id))
  const designAvg = designProjects.length
    ? Math.round(designProjects.reduce((s, p) => s + (computeProgress(p).design?.overall ?? 0), 0) / designProjects.length)
    : 0
  const designOverdue = db.tasks.filter((t) => designIds.has(t.projectId) && t.status !== 'Done' && t.dueDate < date &&
    t.phase && (DESIGN_PHASES as readonly string[]).includes(t.phase))
  const designDue = db.tasks.filter((t) => designIds.has(t.projectId) && t.status !== 'Done' && inPeriod(t.dueDate) &&
    t.phase && (DESIGN_PHASES as readonly string[]).includes(t.phase))
  const designClarifications = db.clarifications.filter((c) => c.department === 'Design' && c.status === 'Open')

  // ------------------------------------------------ execution
  const executionProjects = db.projects.filter((p) => p.services.execution && p.status !== 'Completed')
  const periodReports = db.reports.filter((r) => inPeriod(r.date))
  const filed = periodReports.filter((r) => r.status !== 'Draft')
  const pendingReports = db.reports.filter((r) => r.status === 'Submitted')
  const workerDays = periodReports.reduce((s, r) => s + r.attendance.filter((a) => a.present).length, 0)
  const openIssues = db.issues.filter((i) => i.status === 'Open')
  const delayed = executionProjects.filter((p) => p.delayed)

  // ------------------------------------------------ AMC
  const amcContracts = db.maintenance.filter((m) => m.type === 'AMC')
  const amcValue = amcContracts.reduce((s, m) => s + (m.value ?? 0), 0)
  // Visits come from each contract's repeat schedule as well as visits booked by hand.
  const nextVisits = allOccurrences(db.maintenance, date)
    .filter((o) => o.status !== 'Done')
    .map((o) => ({ visit: { id: o.visit?.id ?? `${o.record.id}-${o.date}`, date: o.date }, record: o.record }))
  const amcInPeriod = allOccurrences(db.maintenance, date).filter((o) => inPeriod(o.date))
  const amcDone = amcInPeriod.filter((o) => o.status === 'Done').length
  const overdueVisits = nextVisits.filter((v) => v.visit.date < date)
  const renewalsDue = renewalReminders(db.maintenance, date)
  // The AMC department's own people lead it once assigned; until then the Execution & Maintenance Head does.
  const amcHead = db.employees.find((e) => e.department === 'AMC') ?? headOf('execution_head')

  // ------------------------------------------------ CEO diary
  const consultations = db.consultations
    .filter((c) => c.status === 'Scheduled' && c.date >= date && inPeriod(c.date))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  const consultationsHeld = db.consultations.filter((c) => c.status === 'Completed' && inPeriod(c.date)).length

  return (
    <div>
      <PageHeader
        title={`Good day, ${user.name}`}
        subtitle="Design, Execution and AMC at a glance — plus money in, money owed and your consultations."
        actions={<>
          <PeriodSwitch />
          <Link to="/consultations" className="btn-secondary">My schedule</Link>
          <Link to="/projects/new" className="btn-primary">New Project</Link>
        </>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="New Leads" value={pad2(newLeads.length)} sub={`${openLeads.length} open in the pipeline`} to="/crm/leads" icon="users" />
        <StatTile label="New Business" value={formatCurrency(newBusiness, true)} sub={`${started.length} project${started.length === 1 ? '' : 's'} started ${when}`} to="/projects" icon="folder" />
        <StatTile
          label="Received" value={formatCurrency(received, true)}
          sub={`${paymentsIn.length} payment${paymentsIn.length === 1 ? '' : 's'} ${when}`} icon="rupee"
          tone="green" to="/accounts/payments"
        />
        <StatTile label="Receivable" value={formatCurrency(owed, true)} sub="Across all clients" tone="amber" to="/crm/clients" />
      </div>

      {/* The three departments, side by side */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <DepartmentBox
          title="Design" icon="pen" accent="design" head={headOf('design_director')}
          to="/projects/design" linkLabel="Open design projects"
          metrics={[
            { label: 'Active Projects', value: pad2(designProjects.length), to: '/projects/design' },
            { label: 'Avg Progress', value: `${designAvg}%` },
            { label: period === 'today' ? 'Due Today' : 'Tasks Due', value: pad2(designDue.length), to: '/tasks/team' },
            { label: 'Overdue Tasks', value: pad2(designOverdue.length), alert: designOverdue.length > 0, to: '/tasks/team' },
          ]}
          listTitle="Projects"
        >
          {designProjects.length === 0 ? (
            <EmptyState title="No active design projects." />
          ) : (
            <ul className="space-y-3">
              {designProjects.slice(0, 4).map((project) => {
                const progress = computeProgress(project).design?.overall ?? 0
                return (
                  <li key={project.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <Link to={`/projects/${project.id}`} className="truncate text-sm font-medium text-stone-800 hover:text-sky-700">{project.name}</Link>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-stone-600">{progress}%</span>
                    </div>
                    <ProgressBar value={progress} size="sm" />
                    <p className="mt-0.5 truncate text-xs text-stone-400">{clientName(project.clientId)}</p>
                  </li>
                )
              })}
            </ul>
          )}
          {designClarifications.length > 0 && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              {designClarifications.length} client clarification{designClarifications.length > 1 ? 's' : ''} open
            </p>
          )}
        </DepartmentBox>

        <DepartmentBox
          title="Execution" icon="hammer" accent="execution" head={headOf('execution_head')}
          to="/execution" linkLabel="Open execution"
          metrics={[
            { label: 'Active Sites', value: pad2(executionProjects.length), to: '/execution' },
            { label: period === 'today' ? "Today's Reports" : 'Reports Filed', value: period === 'today' ? `${pad2(filed.length)}/${pad2(executionProjects.length)}` : pad2(filed.length), to: '/execution/reports' },
            { label: 'Pending Review', value: pad2(pendingReports.length), alert: pendingReports.length > 0, to: '/execution/reports' },
            { label: period === 'today' ? 'Workers Today' : 'Worker-Days', value: pad2(workerDays), to: '/employees/attendance' },
          ]}
          listTitle="Sites"
        >
          {executionProjects.length === 0 ? (
            <EmptyState title="No active sites." />
          ) : (
            <ul className="space-y-3">
              {executionProjects.slice(0, 4).map((project) => {
                const progress = computeProgress(project).execution?.overall ?? 0
                return (
                  <li key={project.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <Link to={`/projects/${project.id}`} className="truncate text-sm font-medium text-stone-800 hover:text-brand-700">{project.name}</Link>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {project.delayed && <Badge tone="red">Delayed</Badge>}
                        <span className="text-xs font-semibold tabular-nums text-stone-600">{progress}%</span>
                      </span>
                    </div>
                    <ProgressBar value={progress} size="sm" tone={project.delayed ? 'amber' : 'green'} />
                    <p className="mt-0.5 truncate text-xs text-stone-400"><SiteName name={project.siteLocation} /></p>
                  </li>
                )
              })}
            </ul>
          )}
          {(openIssues.length > 0 || delayed.length > 0) && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
              {[
                openIssues.length && `${openIssues.length} open site issue${openIssues.length > 1 ? 's' : ''}`,
                delayed.length && `${delayed.length} delayed project${delayed.length > 1 ? 's' : ''}`,
              ].filter(Boolean).join(' · ')}
            </p>
          )}
        </DepartmentBox>

        <DepartmentBox
          title="AMC" icon="leaf" accent="amc" head={amcHead}
          to="/amc" linkLabel="Open AMC"
          metrics={[
            { label: 'Active AMCs', value: pad2(amcContracts.length), to: '/amc' },
            { label: 'Annual Value', value: formatCurrency(amcValue, true), to: '/amc/renewals' },
            { label: 'Visits Done', value: `${pad2(amcDone)}/${pad2(amcInPeriod.length)}`, alert: overdueVisits.length > 0, to: '/amc/calendar' },
            { label: 'Renewals Due', value: pad2(renewalsDue.length), alert: renewalsDue.length > 0, to: '/amc/renewals' },
          ]}
          listTitle="Next visits"
        >
          {nextVisits.length === 0 ? (
            <EmptyState title="No visits scheduled." />
          ) : (
            <ul className="divide-y divide-stone-100">
              {nextVisits.slice(0, 4).map(({ visit, record }) => (
                <li key={visit.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-800">
                      {db.projects.find((p) => p.id === record.projectId)?.name}
                    </p>
                    <p className="text-xs text-stone-400">{record.type}</p>
                  </div>
                  <Badge tone={visit.date < date ? 'red' : 'clay'}>{formatDate(visit.date)}</Badge>
                </li>
              ))}
            </ul>
          )}
          {overdueVisits.length > 0 && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
              {overdueVisits.length} visit{overdueVisits.length > 1 ? 's' : ''} overdue
            </p>
          )}
        </DepartmentBox>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Section
          title="My Consultations"
          description={`${consultations.length} coming up ${when}${consultationsHeld ? ` · ${consultationsHeld} held` : ''}`}
          actions={<Link to="/consultations" className="text-sm font-semibold text-brand-700">Schedule</Link>}
        >
          {consultations.length === 0 ? (
            <EmptyState title="Your diary is clear." />
          ) : (
            <ul className="divide-y divide-stone-100">
              {consultations.slice(0, 5).map((c) => (
                <li key={c.id} className="px-5 py-3">
                  <p className="text-xs font-semibold tabular-nums text-brand-700">
                    {c.date === date ? 'Today' : formatDate(c.date)} · {formatTime(c.start)}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-stone-800">{c.purpose}</p>
                  <p className="text-xs text-stone-400">
                    {partyName(c, db.clients, db.leads)} · booked by {db.employees.find((e) => e.id === c.bookedBy)?.name}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Approvals Waiting">
          {pendingRequests.length === 0 && pendingReports.length === 0 ? (
            <EmptyState title="Nothing waiting on you." />
          ) : (
            <ul className="divide-y divide-stone-100">
              {pendingRequests.map((request) => {
                const project = db.projects.find((p) => p.id === request.projectId)
                return (
                  <li key={request.id}>
                    <Link to="/accounts/payment-requests" className="block px-5 py-3 hover:bg-stone-50">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-stone-800">{project?.name}</p>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-900">{formatCurrency(request.amount)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-stone-400">Payment request · {formatDate(request.date)}</p>
                    </Link>
                  </li>
                )
              })}
              {pendingReports.length > 0 && (
                <li>
                  <Link to="/execution/reports" className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-stone-50">
                    <span className="text-sm font-medium text-stone-800">Daily reports to review</span>
                    <Badge tone="amber">{pendingReports.length}</Badge>
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Section>

        <Section title="Lead Pipeline" actions={<Link to="/crm/leads" className="text-sm font-semibold text-brand-700">All leads</Link>}>
          {openLeads.length === 0 ? (
            <EmptyState title="No open leads." />
          ) : (
            <ul className="divide-y divide-stone-100">
              {openLeads.slice(0, 5).map((lead) => (
                <li key={lead.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-800">{lead.name}</p>
                    <p className="truncate text-xs text-stone-400">{lead.location} · {lead.source}</p>
                  </div>
                  <StatusBadge status={lead.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}
