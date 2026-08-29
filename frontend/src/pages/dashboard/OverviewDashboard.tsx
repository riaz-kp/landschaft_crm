import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { computeProgress, projectType } from '../../domain/progress'
import { formatCurrency, formatDate, pad2 } from '../../domain/format'
import {
  PageHeader, Section, StatTile, StatusBadge, Table, EmptyState, Badge,
} from '../../components/ui'
import { ProgressSummary } from '../../components/ProjectProgress'

/** CEO / Super Admin view — full operational visibility across all five systems. */
export function OverviewDashboard() {
  const db = useDb()
  const { user } = useSession()

  const active = db.projects.filter((p) => p.status !== 'Completed')
  const openLeads = db.leads.filter((l) => !['Won', 'Lost'].includes(l.status))
  const pipeline = openLeads.length
  const received = db.payments.reduce((sum, p) => sum + p.amount, 0)
  const contracted = db.projects.reduce((sum, p) => sum + p.value, 0)
  const pendingRequests = db.paymentRequests.filter((r) => r.status === 'Pending')
  const openIssues = db.issues.filter((i) => i.status === 'Open')
  const submittedReports = db.reports.filter((r) => r.status === 'Submitted')

  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader
        title={`Good day, ${user.name}`}
        subtitle="Full operational view across CRM, design, execution, accounts and workforce."
        actions={<Link to="/projects/new" className="btn-primary">New Project</Link>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Active Projects" value={pad2(active.length)} to="/projects" />
        <StatTile label="Open Leads" value={pad2(pipeline)} sub="Not yet won or lost" to="/crm/leads" />
        <StatTile
          label="Contracted Value" value={formatCurrency(contracted, true)}
          sub="All projects" to="/accounts/payments"
        />
        <StatTile
          label="Received" value={formatCurrency(received, true)}
          sub={`${Math.round((received / contracted) * 100)}% of contracted`}
          tone="green" to="/accounts/payments"
        />
        <StatTile
          label="Reports To Review" value={pad2(submittedReports.length)}
          tone={submittedReports.length ? 'amber' : 'green'} to="/execution/reports"
        />
        <StatTile
          label="Payment Requests" value={pad2(pendingRequests.length)}
          sub="Pending approval" tone={pendingRequests.length ? 'amber' : 'green'}
          to="/accounts/payment-requests"
        />
        <StatTile
          label="Open Issues" value={pad2(openIssues.length)}
          tone={openIssues.length ? 'red' : 'green'} to="/execution/reports"
        />
        <StatTile
          label="Delayed Projects"
          value={pad2(db.projects.filter((p) => p.delayed && p.status !== 'Completed').length)}
          tone="red" to="/projects"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Section
          title="Active Projects" className="xl:col-span-2"
          actions={<Link to="/projects" className="text-sm font-semibold text-brand-700">View all</Link>}
        >
          <Table head={['Project', 'Client', 'Type', 'Progress', 'Status']}>
            {active.slice(0, 7).map((project) => (
              <tr key={project.id} className="row-hover">
                <td className="td">
                  <Link to={`/projects/${project.id}`} className="font-medium text-stone-900 hover:text-brand-700">
                    {project.name}
                  </Link>
                  <span className="block text-xs text-stone-400">{project.code}</span>
                </td>
                <td className="td">{clientName(project.clientId)}</td>
                <td className="td"><Badge tone="stone">{projectType(project)}</Badge></td>
                <td className="td"><ProgressSummary project={project} /></td>
                <td className="td">
                  {project.delayed
                    ? <Badge tone="red">Delayed</Badge>
                    : <StatusBadge status={project.status} />}
                </td>
              </tr>
            ))}
          </Table>
        </Section>

        <div className="space-y-6">
          <Section title="Lead Pipeline">
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

          <Section title="Approvals Waiting">
            {pendingRequests.length === 0 ? (
              <EmptyState title="Nothing waiting on you." />
            ) : (
              <ul className="divide-y divide-stone-100">
                {pendingRequests.map((request) => {
                  const project = db.projects.find((p) => p.id === request.projectId)
                  return (
                    <li key={request.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-stone-800">{project?.name}</p>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-900">
                          {formatCurrency(request.amount)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-stone-400">
                        Payment request · {formatDate(request.date)}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <Section title="Progress by Project" className="mt-6">
        <div className="grid gap-x-8 gap-y-5 px-5 py-5 md:grid-cols-2">
          {active.map((project) => {
            const progress = computeProgress(project)
            return (
              <div key={project.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <Link to={`/projects/${project.id}`} className="truncate text-sm font-medium text-stone-800 hover:text-brand-700">
                    {project.name}
                  </Link>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-brand-700">
                    {progress.overall}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                  <div className="h-2 rounded-full bg-brand-500" style={{ width: `${progress.overall}%` }} />
                </div>
                <p className="mt-1 text-xs text-stone-400">{projectType(project)}</p>
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}
