import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { formatCurrency, formatDate } from '../../domain/format'
import { PageHeader, Section, Table, EmptyState, Badge } from '../../components/ui'

export function Clients() {
  const db = useDb()

  return (
    <div>
      <PageHeader title="Clients" subtitle="Converted leads and their projects." />
      <Section>
        {db.clients.length === 0 ? (
          <EmptyState title="No clients yet." />
        ) : (
          <Table head={['Client', 'Contact', 'Address', 'Projects', 'Value', 'Since']}>
            {db.clients.map((client) => {
              const projects = db.projects.filter((p) => p.clientId === client.id)
              const value = projects.reduce((sum, p) => sum + p.value, 0)
              return (
                <tr key={client.id} className="row-hover">
                  <td className="td font-medium text-stone-900">{client.name}</td>
                  <td className="td">
                    {client.phone}
                    {client.email && <span className="block text-xs text-stone-400">{client.email}</span>}
                  </td>
                  <td className="td">{client.address}</td>
                  <td className="td">
                    {projects.length === 0 ? (
                      <span className="text-stone-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {projects.map((p) => (
                          <Link key={p.id} to={`/projects/${p.id}`}>
                            <Badge tone="green">{p.code}</Badge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="td tabular-nums">{value ? formatCurrency(value) : '—'}</td>
                  <td className="td tabular-nums">{formatDate(client.createdAt)}</td>
                </tr>
              )
            })}
          </Table>
        )}
      </Section>
    </div>
  )
}
