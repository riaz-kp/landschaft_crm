import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { daysBetween, formatCurrency, formatDate, today } from '../../domain/format'
import { PageHeader, Section, Table, EmptyState, Badge, StatTile, StatusBadge } from '../../components/ui'
import { ContactNumbers } from '../../components/ContactFields'

/** A renewal is flagged once it is inside this many days. */
const RENEWAL_WINDOW_DAYS = 60

/** AMC renewals coming up, and handed-over sites not yet on an AMC. */
export function AmcRenewals() {
  const db = useDb()

  const contracts = db.maintenance
    .filter((m) => m.type === 'AMC' && m.renewalDate)
    .map((m) => ({ record: m, daysLeft: daysBetween(today(), m.renewalDate!) }))
    .sort((a, b) => a.daysLeft - b.daysLeft)

  // Projects whose execution is complete or in free maintenance, with no AMC yet.
  const withAmc = new Set(db.maintenance.filter((m) => m.type === 'AMC').map((m) => m.projectId))
  const prospects = db.projects.filter(
    (p) => p.services.execution && !withAmc.has(p.id) &&
      (p.status === 'Completed' || db.maintenance.some((m) => m.projectId === p.id)),
  )

  const project = (id: string) => db.projects.find((p) => p.id === id)
  const clientOf = (projectId: string) => db.clients.find((c) => c.id === project(projectId)?.clientId)
  const dueSoon = contracts.filter((c) => c.daysLeft <= RENEWAL_WINDOW_DAYS)

  return (
    <div>
      <PageHeader title="AMC Renewals" subtitle="Contracts coming up for renewal, and handovers to convert to an AMC." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Active AMCs" value={contracts.length} />
        <StatTile
          label={`Due in ${RENEWAL_WINDOW_DAYS} Days`} value={dueSoon.length}
          tone={dueSoon.length ? 'amber' : 'green'}
        />
        <StatTile
          label="Value Up For Renewal"
          value={formatCurrency(dueSoon.reduce((s, c) => s + (c.record.value ?? 0), 0), true)}
        />
        <StatTile label="Not Yet On AMC" value={prospects.length} tone={prospects.length ? 'clay' : 'stone'} />
      </div>

      <Section title="Renewals" className="mb-6">
        {contracts.length === 0 ? (
          <EmptyState title="No active AMCs." />
        ) : (
          <Table head={['Site', 'Client', 'Contact', 'Period', 'Value', 'Renewal']}>
            {contracts.map(({ record, daysLeft }) => {
              const client = clientOf(record.projectId)
              return (
                <tr key={record.id} className="row-hover">
                  <td className="td font-medium text-stone-900">
                    <Link to={`/projects/${record.projectId}`} className="hover:text-brand-700">
                      {project(record.projectId)?.name ?? '—'}
                    </Link>
                  </td>
                  <td className="td">
                    {client ? <Link to={`/crm/clients/${client.id}`} className="hover:text-brand-700">{client.name}</Link> : '—'}
                  </td>
                  <td className="td">{client ? <ContactNumbers phone={client.phone} whatsapp={client.whatsapp} /> : '—'}</td>
                  <td className="td tabular-nums">{formatDate(record.startDate)} – {formatDate(record.endDate)}</td>
                  <td className="td font-semibold tabular-nums">{record.value ? formatCurrency(record.value) : '—'}</td>
                  <td className="td">
                    <span className="block tabular-nums">{formatDate(record.renewalDate!)}</span>
                    {daysLeft < 0 ? (
                      <Badge tone="red">Lapsed {-daysLeft}d ago</Badge>
                    ) : daysLeft <= RENEWAL_WINDOW_DAYS ? (
                      <Badge tone="amber">Due in {daysLeft}d</Badge>
                    ) : (
                      <Badge tone="green">{daysLeft} days left</Badge>
                    )}
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Section>

      <Section title="Handovers Without an AMC" description="Execution complete or in free maintenance — candidates for an AMC.">
        {prospects.length === 0 ? (
          <EmptyState title="Every handed-over site is on an AMC." />
        ) : (
          <Table head={['Project', 'Client', 'Contact', 'Status', 'Free Maintenance Ends']}>
            {prospects.map((p) => {
              const client = clientOf(p.id)
              const free = db.maintenance.find((m) => m.projectId === p.id && m.type === 'Free Maintenance')
              return (
                <tr key={p.id} className="row-hover">
                  <td className="td font-medium text-stone-900">
                    <Link to={`/projects/${p.id}`} className="hover:text-brand-700">{p.name}</Link>
                    <span className="block text-xs text-stone-400">{p.code}</span>
                  </td>
                  <td className="td">{client?.name ?? '—'}</td>
                  <td className="td">{client ? <ContactNumbers phone={client.phone} whatsapp={client.whatsapp} /> : '—'}</td>
                  <td className="td"><StatusBadge status={p.status} /></td>
                  <td className="td tabular-nums">{free ? formatDate(free.endDate) : '—'}</td>
                </tr>
              )
            })}
          </Table>
        )}
      </Section>
    </div>
  )
}
