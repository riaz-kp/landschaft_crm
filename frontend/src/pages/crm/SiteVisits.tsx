import { useDb } from '../../state/useDb'
import { formatDate } from '../../domain/format'
import { PageHeader, Section, StatusBadge, Table, EmptyState } from '../../components/ui'

export function SiteVisits() {
  const db = useDb()
  const visits = [...db.siteVisits].sort((a, b) => b.date.localeCompare(a.date))

  const subjectName = (leadId?: string, clientId?: string) => {
    if (leadId) return db.leads.find((l) => l.id === leadId)?.name ?? '—'
    if (clientId) return db.clients.find((c) => c.id === clientId)?.name ?? '—'
    return '—'
  }
  const staffName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader title="Site Visits" subtitle="Visits scheduled against leads and clients." />
      <Section>
        {visits.length === 0 ? (
          <EmptyState title="No site visits recorded." />
        ) : (
          <Table head={['Date', 'Lead / Client', 'Location', 'Assigned To', 'Notes', 'Status']}>
            {visits.map((visit) => (
              <tr key={visit.id} className="row-hover">
                <td className="td tabular-nums font-medium text-stone-900">{formatDate(visit.date)}</td>
                <td className="td">{subjectName(visit.leadId, visit.clientId)}</td>
                <td className="td">{visit.location}</td>
                <td className="td">{staffName(visit.assignedTo)}</td>
                <td className="td max-w-sm">{visit.notes}</td>
                <td className="td"><StatusBadge status={visit.status} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  )
}
