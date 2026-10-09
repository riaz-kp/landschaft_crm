import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { can } from '../../domain/roles'
import { formatCurrency, today } from '../../domain/format'
import { allOccurrences, renewalReminders, visitReminders } from '../../domain/amc'
import { PageHeader, Section, EmptyState, StatTile, Pills } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { AmcContractCard } from './AmcContractCard'
import { AmcContractModal } from './AmcContractForm'
import { AmcReminders } from './AmcReminders'

type Filter = 'active' | 'AMC' | 'Free Maintenance' | 'ended'

/**
 * AMC — Annual Maintenance Contracts. Execution can continue into a free
 * maintenance month and then an AMC, or an AMC can be sold on its own. Each
 * contract carries a repeat visit schedule that feeds the AMC calendar and
 * its reminders.
 */
export function AmcContracts() {
  const db = useDb()
  const { roleKey } = useSession()
  const editable = can.manageAmc(roleKey)
  const [filter, setFilter] = useState<Filter>('active')
  const [creating, setCreating] = useState(false)

  const amc = db.maintenance.filter((m) => m.type === 'AMC')
  const active = db.maintenance.filter((m) => m.endDate >= today())
  const reminders = visitReminders(db.maintenance, today())
  const renewals = renewalReminders(db.maintenance, today())
  const upcoming = allOccurrences(active, today()).filter((o) => o.status !== 'Done' && o.date >= today()).length

  const records = db.maintenance
    .filter((m) => filter === 'active' ? m.endDate >= today()
      : filter === 'ended' ? m.endDate < today()
      : m.type === filter)
    .sort((a, b) => (a.type === b.type ? b.startDate.localeCompare(a.startDate) : a.type === 'AMC' ? -1 : 1))

  return (
    <div>
      <PageHeader
        title="AMC Contracts"
        subtitle="Annual Maintenance Contracts — after our own execution or taken on by themselves. Each contract repeats its visits on a schedule you set, with reminders before every visit and before renewal."
        actions={<>
          <Link to="/amc/calendar" className="btn-secondary"><Icon name="calendar" className="h-4 w-4" /> AMC calendar</Link>
          {editable && (
            <button onClick={() => setCreating(true)} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> New AMC contract</button>
          )}
        </>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Active Contracts" value={active.length} tone="green" icon="leaf" />
        <StatTile label="Reminders" value={reminders.length} tone={reminders.length ? 'amber' : 'stone'} icon="bell" sub="visits due soon or overdue" />
        <StatTile label="Upcoming Visits" value={upcoming} tone="blue" icon="calendar" to="/amc/calendar" sub="for the rest of the terms" />
        <StatTile
          label="AMC Value" icon="rupee" tone="clay"
          value={formatCurrency(amc.reduce((s, m) => s + (m.value ?? 0), 0), true)}
          sub={renewals.length ? `${renewals.length} renewal${renewals.length === 1 ? '' : 's'} due` : 'Annual'} to="/amc/renewals"
        />
      </div>

      <AmcReminders className="mb-6" />

      {/* The progression the document describes */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
        {['Execution complete', `Free maintenance · ${db.settings.freeMaintenanceMonths} month`, 'AMC'].map((step, i, all) => (
          <span key={step} className="flex items-center gap-2">
            <span className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 font-medium text-stone-600">{step}</span>
            {i < all.length - 1 && <Icon name="chevron" className="h-3.5 w-3.5 text-stone-300" />}
          </span>
        ))}
        <span className="ml-1">— or an AMC on its own, for a garden someone else built.</span>
      </div>

      <div className="mb-4">
        <Pills<Filter>
          active={filter}
          onChange={setFilter}
          options={[
            { key: 'active', label: 'Running', count: active.length },
            { key: 'AMC', label: 'AMCs', count: amc.length },
            { key: 'Free Maintenance', label: 'Free maintenance', count: db.maintenance.length - amc.length },
            { key: 'ended', label: 'Ended', count: db.maintenance.length - active.length },
          ]}
        />
      </div>

      {records.length === 0 ? (
        <Section><EmptyState title="No contracts here." hint={editable ? 'Use New AMC contract to start one.' : undefined} icon="leaf" /></Section>
      ) : (
        <div className="space-y-6">
          {records.map((record) => <AmcContractCard key={record.id} record={record} canManage={editable} />)}
        </div>
      )}

      {creating && <AmcContractModal onClose={() => setCreating(false)} />}
    </div>
  )
}
