import { useDb } from '../../state/useDb'
import { today } from '../../domain/format'
import {
  PageHeader, Section, Table, Badge, StatTile,
} from '../../components/ui'

/** Site labour. Workers are recorded by foremen and have no login. */
export function ExecutionWorkers() {
  const db = useDb()
  const todaysReports = db.reports.filter((r) => r.date === today())

  const isOnSiteToday = (workerId: string) =>
    todaysReports.some((r) => r.attendance.some((a) => a.workerId === workerId && a.present))

  const siteFor = (workerId: string) =>
    todaysReports.find((r) => r.attendance.some((a) => a.workerId === workerId && a.present))?.siteLocation

  const active = db.workers.filter((w) => w.active)

  return (
    <div>
      <PageHeader
        title="Execution Workers"
        subtitle="Site labour. Workers do not log in — foremen record them on the daily report."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total Workers" value={db.workers.length} />
        <StatTile label="Active" value={active.length} tone="green" />
        <StatTile
          label="On Site Today"
          value={active.filter((w) => isOnSiteToday(w.id)).length}
          tone="amber"
        />
        <StatTile label="Inactive" value={db.workers.filter((w) => !w.active).length} tone="stone" />
      </div>

      <Section>
        <Table head={['Worker', 'Skill', 'Phone', 'Today', 'Status']}>
          {db.workers.map((worker) => (
            <tr key={worker.id} className="row-hover">
              <td className="td font-medium text-stone-900">{worker.name}</td>
              <td className="td">{worker.skill}</td>
              <td className="td tabular-nums">{worker.phone}</td>
              <td className="td">
                {isOnSiteToday(worker.id)
                  ? <Badge tone="green">{siteFor(worker.id)}</Badge>
                  : <span className="text-stone-400">—</span>}
              </td>
              <td className="td">
                <Badge tone={worker.active ? 'green' : 'stone'}>
                  {worker.active ? 'Active' : 'Inactive'}
                </Badge>
              </td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  )
}
