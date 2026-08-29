import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { formatDate, pad2 } from '../../domain/format'
import type { LeadStatus } from '../../domain/types'
import {
  PageHeader, Section, StatTile, StatusBadge, Table, EmptyState,
} from '../../components/ui'

const FUNNEL: LeadStatus[] = ['New', 'Contacted', 'Site Visit', 'Quoted', 'Won']

/** Swalih's view — leads and marketing. */
export function MarketingDashboard() {
  const db = useDb()
  const { user } = useSession()

  const myLeads = db.leads.filter((l) => l.ownerId === user.id)
  const open = myLeads.filter((l) => !['Won', 'Lost'].includes(l.status))
  const won = myLeads.filter((l) => l.status === 'Won')
  const upcomingVisits = db.siteVisits.filter((v) => v.status === 'Scheduled')

  return (
    <div>
      <PageHeader
        title={`Good day, ${user.name}`}
        subtitle="Leads and marketing — Lead → Generate → Close."
        actions={<Link to="/crm/leads" className="btn-primary">All Leads</Link>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Open Leads" value={pad2(open.length)} to="/crm/leads" />
        <StatTile label="Won" value={pad2(won.length)} tone="green" to="/crm/leads" />
        <StatTile
          label="Conversion"
          value={myLeads.length ? `${Math.round((won.length / myLeads.length) * 100)}%` : '—'}
        />
        <StatTile label="Visits Scheduled" value={pad2(upcomingVisits.length)} to="/crm/site-visits" />
      </div>

      <Section title="Funnel" className="mt-6">
        <div className="grid grid-cols-2 gap-4 px-5 py-5 sm:grid-cols-5">
          {FUNNEL.map((stage) => {
            const count = myLeads.filter((l) => l.status === stage).length
            return (
              <div key={stage} className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-stone-900">{pad2(count)}</p>
                <p className="mt-1 text-xs font-medium text-stone-500">{stage}</p>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="My Leads" className="mt-6">
        {open.length === 0 ? (
          <EmptyState title="No open leads." />
        ) : (
          <Table head={['Lead', 'Location', 'Source', 'Requirement', 'Status']}>
            {open.map((lead) => (
              <tr key={lead.id} className="row-hover">
                <td className="td font-medium text-stone-900">
                  {lead.name}
                  <span className="block text-xs text-stone-400">{formatDate(lead.createdAt)}</span>
                </td>
                <td className="td">{lead.location}</td>
                <td className="td">{lead.source}</td>
                <td className="td max-w-xs truncate">{lead.requirement}</td>
                <td className="td"><StatusBadge status={lead.status} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  )
}
