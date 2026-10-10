import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { formatDate, formatTime, today } from '../../domain/format'
import { crewOf } from '../../domain/workers'
import type { Employee } from '../../domain/types'
import {
  Section, Table, EmptyState, StatTile, StatusBadge, SiteName, Avatar, SearchInput,
} from '../../components/ui'
import { Icon } from '../../components/Icon'

/**
 * The workers who have worked under a foreman: how many days each, where, and
 * the daily reports behind it. Open a worker's row for their reports with this
 * foreman.
 */
export function ForemanCrew({ foreman }: { foreman: Employee }) {
  const db = useDb()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const crew = useMemo(() => crewOf(db.reports, foreman.id, today()), [db.reports, foreman.id])
  const month = today().slice(0, 7)
  const worker = (id: string) => db.workers.find((w) => w.id === id)
  const project = (id: string) => db.projects.find((p) => p.id === id)

  const q = query.trim().toLowerCase()
  const shown = crew.filter((c) => !q || `${worker(c.workerId)?.name ?? ''} ${worker(c.workerId)?.skill ?? ''}`.toLowerCase().includes(q))
  const workerDays = crew.reduce((s, c) => s + c.days, 0)
  const monthDays = crew.reduce((s, c) => s + new Set(c.reports.filter((r) => r.date.startsWith(month)).map((r) => r.date)).size, 0)
  const sites = new Set(crew.flatMap((c) => c.projectIds)).size

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Workers Led" value={crew.length} icon="hardhat" />
        <StatTile label="Worker-Days" value={workerDays} tone="green" icon="calendar" sub="all time" />
        <StatTile label="This Month" value={monthDays} tone="blue" icon="clock" sub="worker-days" />
        <StatTile label="Sites" value={sites} tone="clay" icon="pin" />
      </div>

      <Section
        title="Workers under this foreman"
        description="From the daily reports they filed. Open a row for the reports each worker was on."
        actions={<SearchInput value={query} onChange={setQuery} placeholder="Search workers…" className="w-full sm:w-60" />}
      >
        {shown.length === 0 ? (
          <EmptyState
            title={crew.length ? 'No worker matches.' : 'No workers on this foreman’s reports yet.'}
            icon="hardhat"
          />
        ) : (
          <Table head={['Worker', 'Skill', 'Days', 'This Month', 'Last on Site', 'Sites', '']}>
            {shown.map((c) => {
              const w = worker(c.workerId)
              const open = openId === c.workerId
              const thisMonth = new Set(c.reports.filter((r) => r.date.startsWith(month)).map((r) => r.date)).size
              return (
                <Fragment key={c.workerId}>
                  <tr className="row-hover">
                    <td className="td">
                      <Link to={`/employees/workers/${c.workerId}`} className="flex items-center gap-2.5">
                        <Avatar name={w?.name ?? '?'} size="sm" src={w?.photo} />
                        <span className="font-medium text-stone-900 hover:text-brand-700">{w?.name ?? 'Removed worker'}</span>
                      </Link>
                    </td>
                    <td className="td">{w?.skill ?? '—'}</td>
                    <td className="td font-semibold tabular-nums text-stone-900">{c.days}</td>
                    <td className="td tabular-nums">{thisMonth}</td>
                    <td className="td tabular-nums">{c.lastDate === today() ? 'Today' : formatDate(c.lastDate)}</td>
                    <td className="td">
                      {c.projectIds.map((id) => project(id)?.siteLocation).filter(Boolean).map((s, i) => (
                        <span key={i} className="block truncate"><SiteName name={s!} /></span>
                      ))}
                    </td>
                    <td className="td text-right">
                      <button
                        onClick={() => setOpenId(open ? null : c.workerId)}
                        className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-brand-700 hover:text-brand-800"
                        aria-expanded={open}
                      >
                        {c.reports.length} report{c.reports.length === 1 ? '' : 's'}
                        <Icon name="chevron" className={`h-4 w-4 transition ${open ? '-rotate-90' : 'rotate-90'}`} />
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={7} className="bg-stone-50/70 px-4 py-3">
                        <ul className="divide-y divide-stone-200/70 rounded-xl border border-stone-200 bg-white">
                          {c.reports.map((r) => {
                            const entry = r.attendance.find((a) => a.workerId === c.workerId)
                            return (
                              <li key={r.id}>
                                {/* One row on wide screens; on a phone the site drops to its own line. */}
                                <Link to={`/execution/reports/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm hover:bg-brand-50/40">
                                  <span className="font-medium tabular-nums text-stone-900 sm:w-24">{formatDate(r.date)}</span>
                                  <span className="order-last w-full truncate text-stone-600 sm:order-none sm:w-auto sm:min-w-0 sm:flex-1">
                                    <SiteName name={r.siteLocation} /> · {project(r.projectId)?.name}
                                  </span>
                                  <span className="tabular-nums text-stone-500">
                                    {formatTime(entry?.checkIn || r.startTime)} – {formatTime(entry?.checkOut || r.endTime)}
                                  </span>
                                  <span className="ml-auto sm:ml-0"><StatusBadge status={r.status} /></span>
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </Table>
        )}
      </Section>
    </div>
  )
}
