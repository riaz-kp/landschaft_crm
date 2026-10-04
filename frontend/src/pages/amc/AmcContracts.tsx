import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { formatCurrency, formatDate } from '../../domain/format'
import {
  PageHeader, Section, StatusBadge, Table, EmptyState, Badge, StatTile,
} from '../../components/ui'
import { Icon } from '../../components/Icon'

/**
 * §19 — execution can continue into a free maintenance month and then an AMC.
 * AMC now runs as its own department, separate from Execution.
 */
export function AmcContracts() {
  const db = useDb()

  const free = db.maintenance.filter((m) => m.type === 'Free Maintenance')
  const amc = db.maintenance.filter((m) => m.type === 'AMC')
  const upcoming = db.maintenance.flatMap((m) =>
    m.visits.filter((v) => !v.done).map((v) => ({ visit: v, record: m })),
  )

  const projectOf = (id: string) => db.projects.find((p) => p.id === id)
  const clientName = (projectId: string) =>
    db.clients.find((c) => c.id === projectOf(projectId)?.clientId)?.name
  const workerNames = (ids: string[]) =>
    ids.map((id) => db.workers.find((w) => w.id === id)?.name).filter(Boolean).join(', ')

  return (
    <div>
      <PageHeader
        title="AMC Contracts"
        subtitle="The AMC department — free maintenance after handover, then annual maintenance contracts."
        actions={<Link to="/amc/visits" className="btn-secondary">Visit schedule</Link>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Free Maintenance" value={free.length} />
        <StatTile label="Active AMCs" value={amc.length} tone="green" />
        <StatTile label="Upcoming Visits" value={upcoming.length} tone="amber" to="/amc/visits" />
        <StatTile
          label="AMC Value"
          value={formatCurrency(amc.reduce((s, m) => s + (m.value ?? 0), 0), true)}
          sub="Annual" to="/amc/renewals"
        />
      </div>

      {/* The progression the document describes */}
      <Section title="Maintenance Lifecycle" className="mb-6">
        <div className="flex flex-wrap items-center gap-3 px-5 py-5 text-sm">
          {['Execution Complete', `Free Maintenance · ${db.settings.freeMaintenanceMonths} month`, 'AMC'].map(
            (step, index, all) => (
              <div key={step} className="flex items-center gap-3">
                <span className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-medium text-stone-700">
                  {step}
                </span>
                {index < all.length - 1 && <Icon name="chevron" className="h-4 w-4 text-stone-400" />}
              </div>
            ),
          )}
        </div>
      </Section>

      {db.maintenance.length === 0 ? (
        <Section><EmptyState title="No maintenance records yet." /></Section>
      ) : (
        <div className="space-y-6">
          {db.maintenance.map((record) => (
            <Section
              key={record.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <Link to={`/projects/${record.projectId}`} className="hover:text-brand-700">
                    {projectOf(record.projectId)?.name ?? '—'}
                  </Link>
                  <Badge tone={record.type === 'AMC' ? 'clay' : 'green'}>{record.type}</Badge>
                </span>
              }
              description={
                `${clientName(record.projectId) ?? '—'} · ${formatDate(record.startDate)} – ` +
                `${formatDate(record.endDate)} · ${record.visitSchedule}`
              }
              actions={
                <div className="flex items-center gap-2">
                  {record.value && <span className="text-sm font-semibold tabular-nums">{formatCurrency(record.value)}</span>}
                  {record.renewalDate && <Badge tone="amber">Renews {formatDate(record.renewalDate)}</Badge>}
                </div>
              }
            >
              <div className="grid gap-5 px-5 py-4 sm:grid-cols-2">
                <div>
                  <p className="label">Scope of Work</p>
                  <p className="mt-1 text-sm text-stone-700">{record.scopeOfWork}</p>
                </div>
                <div>
                  <p className="label">Assigned Team</p>
                  <p className="mt-1 text-sm text-stone-700">{workerNames(record.teamIds) || '—'}</p>
                </div>
              </div>
              <Table head={['Visit Date', 'Team', 'Notes', 'Issues', 'Photos', 'Status']}>
                {record.visits.map((visit) => (
                  <tr key={visit.id} className="row-hover">
                    <td className="td tabular-nums font-medium text-stone-900">{formatDate(visit.date)}</td>
                    <td className="td">{workerNames(visit.teamIds)}</td>
                    <td className="td max-w-sm">{visit.notes || '—'}</td>
                    <td className="td">
                      {visit.issues.length ? (
                        <span className="text-clay-800">{visit.issues.join('; ')}</span>
                      ) : '—'}
                    </td>
                    <td className="td tabular-nums">{visit.photoCount || '—'}</td>
                    <td className="td"><StatusBadge status={visit.done ? 'Completed' : 'Scheduled'} /></td>
                  </tr>
                ))}
              </Table>
            </Section>
          ))}
        </div>
      )}
    </div>
  )
}
