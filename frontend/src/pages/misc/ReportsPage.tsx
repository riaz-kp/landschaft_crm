import { useDb } from '../../state/useDb'
import { computeProgress, projectType } from '../../domain/progress'
import { formatCurrency, pad2 } from '../../domain/format'
import { DESIGN_PHASES, PHASE_LABELS } from '../../domain/types'
import {
  PageHeader, Section, Table, StatTile, ProgressBar, Badge,
} from '../../components/ui'

/** Management reporting across the five systems. */
export function ReportsPage() {
  const db = useDb()

  const active = db.projects.filter((p) => p.status !== 'Completed')
  const contracted = db.projects.reduce((s, p) => s + p.value, 0)
  const received = db.payments.reduce((s, p) => s + p.amount, 0)

  const byType = (['Design Only', 'Execution Only', 'Design + Execution'] as const).map((type) => ({
    type,
    projects: db.projects.filter((p) => projectType(p) === type),
  }))

  const leadsBySource = Object.entries(
    db.leads.reduce<Record<string, { total: number; won: number }>>((acc, lead) => {
      acc[lead.source] ??= { total: 0, won: 0 }
      acc[lead.source].total += 1
      if (lead.status === 'Won') acc[lead.source].won += 1
      return acc
    }, {}),
  ).sort((a, b) => b[1].total - a[1].total)

  const workerDays = db.reports.reduce(
    (s, r) => s + r.attendance.filter((a) => a.present).length, 0,
  )

  return (
    <div>
      <PageHeader title="Reports" subtitle="Portfolio, pipeline, financial and workforce summaries." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Active Projects" value={pad2(active.length)} />
        <StatTile label="Contracted" value={formatCurrency(contracted, true)} />
        <StatTile
          label="Collected" value={`${Math.round((received / contracted) * 100)}%`} tone="green"
        />
        <StatTile label="Worker-Days Logged" value={workerDays} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Portfolio by Project Type">
          <Table head={['Type', 'Projects', 'Value', 'Average Progress']}>
            {byType.map(({ type, projects }) => {
              const average = projects.length
                ? Math.round(projects.reduce((s, p) => s + computeProgress(p).overall, 0) / projects.length)
                : 0
              return (
                <tr key={type} className="row-hover">
                  <td className="td font-medium text-stone-900">{type}</td>
                  <td className="td tabular-nums">{projects.length}</td>
                  <td className="td tabular-nums">
                    {formatCurrency(projects.reduce((s, p) => s + p.value, 0), true)}
                  </td>
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

        <Section title="Lead Sources">
          <Table head={['Source', 'Leads', 'Won', 'Conversion']}>
            {leadsBySource.map(([source, stats]) => (
              <tr key={source} className="row-hover">
                <td className="td font-medium text-stone-900">{source}</td>
                <td className="td tabular-nums">{stats.total}</td>
                <td className="td tabular-nums">{stats.won}</td>
                <td className="td">
                  <Badge tone={stats.won ? 'green' : 'stone'}>
                    {Math.round((stats.won / stats.total) * 100)}%
                  </Badge>
                </td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section title="Design Phase Throughput">
          <Table head={['Phase', 'Projects', 'Complete', 'Average']}>
            {DESIGN_PHASES.map((key) => {
              const projects = db.projects.filter((p) => p.services.design && p.design[key].enabled)
              const complete = projects.filter((p) => p.design[key].progress === 100).length
              const average = projects.length
                ? Math.round(projects.reduce((s, p) => s + p.design[key].progress, 0) / projects.length)
                : 0
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

        <Section title="Foreman Reporting">
          <Table head={['Foreman', 'Reports', 'Approved', 'Worker-Days']}>
            {db.employees.filter((e) => e.role === 'foreman').map((foreman) => {
              const reports = db.reports.filter((r) => r.foremanId === foreman.id)
              return (
                <tr key={foreman.id} className="row-hover">
                  <td className="td font-medium text-stone-900">{foreman.name}</td>
                  <td className="td tabular-nums">{reports.length}</td>
                  <td className="td tabular-nums">
                    {reports.filter((r) => r.status === 'Approved').length}
                  </td>
                  <td className="td tabular-nums">
                    {reports.reduce((s, r) => s + r.attendance.filter((a) => a.present).length, 0)}
                  </td>
                </tr>
              )
            })}
          </Table>
        </Section>
      </div>
    </div>
  )
}
