import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../../state/useDb'
import { computeProgress, projectType } from '../../../domain/progress'
import { formatCurrency, formatDate, formatDateLong } from '../../../domain/format'
import type { Client, Department } from '../../../domain/types'
import {
  Section, Table, EmptyState, Badge, StatusBadge, ProgressBar, DepartmentBadge, Pills,
} from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { clientHistory } from './history'

export function WorkHistory({ client }: { client: Client }) {
  const db = useDb()
  const [filter, setFilter] = useState<Department | 'All'>('All')

  const projects = db.projects.filter((p) => p.clientId === client.id)
  const history = clientHistory(db, client.id)
  const departments = [...new Set(history.map((h) => h.department))]
  const shown = filter === 'All' ? history : history.filter((h) => h.department === filter)

  // Group by month so a long relationship stays readable.
  const months: { label: string; items: typeof shown }[] = []
  for (const item of shown) {
    const label = new Date(item.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    const last = months[months.length - 1]
    if (last?.label === label) last.items.push(item)
    else months.push({ label, items: [item] })
  }

  return (
    <div className="space-y-6">
      <Section title="Projects" description={`${projects.length} project${projects.length === 1 ? '' : 's'} with this client`}>
        {projects.length === 0 ? (
          <EmptyState title="No projects yet." />
        ) : (
          <Table head={['Project', 'Type', 'Period', 'Progress', 'Value', 'Status']}>
            {projects.map((project) => {
              const progress = computeProgress(project).overall
              return (
                <tr key={project.id} className="row-hover">
                  <td className="td">
                    <Link to={`/projects/${project.id}`} className="font-medium text-stone-900 hover:text-brand-700">
                      {project.name}
                    </Link>
                    <span className="block text-xs text-stone-400">{project.code}</span>
                  </td>
                  <td className="td"><Badge tone="stone">{projectType(project)}</Badge></td>
                  <td className="td tabular-nums">
                    {formatDate(project.startDate)} – {formatDate(project.expectedCompletion)}
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-24"><ProgressBar value={progress} size="sm" /></div>
                      <span className="text-xs font-semibold tabular-nums">{progress}%</span>
                    </div>
                  </td>
                  <td className="td tabular-nums">{formatCurrency(project.value)}</td>
                  <td className="td">
                    {project.delayed && project.status !== 'Completed'
                      ? <Badge tone="red">Delayed</Badge>
                      : <StatusBadge status={project.status} />}
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Section>

      <Section
        title="Work History"
        description="Every piece of work done for this client, drawn from projects, site reports, AMC visits and accounts."
      >
        <div className="border-b border-stone-100 px-5 py-3">
          <Pills
            active={filter}
            onChange={setFilter}
            options={[
              { key: 'All' as const, label: 'All', count: history.length },
              ...departments.map((d) => ({ key: d, label: d, count: history.filter((h) => h.department === d).length })),
            ]}
          />
        </div>
        {months.length === 0 ? (
          <EmptyState title="Nothing recorded yet." />
        ) : (
          <div className="px-5 py-4">
            {months.map((month) => (
              <div key={month.label} className="mb-6 last:mb-0">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-400">{month.label}</p>
                <ol className="relative space-y-4 border-l border-stone-200 pl-6">
                  {month.items.map((item) => (
                    <li key={item.id} className="relative">
                      <span className="absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500">
                        <Icon name={item.icon} className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {item.to ? (
                          <Link to={item.to} className="text-sm font-medium text-stone-900 hover:text-brand-700">{item.title}</Link>
                        ) : (
                          <span className="text-sm font-medium text-stone-900">{item.title}</span>
                        )}
                        <DepartmentBadge department={item.department} />
                      </div>
                      <p className="mt-0.5 text-xs text-stone-400">{formatDateLong(item.date)}</p>
                      {item.detail && <p className="mt-1 text-sm text-stone-600">{item.detail}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
