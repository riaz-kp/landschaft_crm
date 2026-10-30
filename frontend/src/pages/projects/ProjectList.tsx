import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { usePermissions } from '../../state/permissions'
import { projectType } from '../../domain/progress'
import { daysBetween, formatCurrency, formatDate, today } from '../../domain/format'
import { amcProgress, describeSchedule, occurrencesFor } from '../../domain/amc'
import { PROJECT_CATEGORIES, type Project, type ProjectCategory } from '../../domain/types'
import { formatArea } from '../../domain/projectInfo'
import {
  PageHeader, Section, StatusBadge, SiteName, Table, EmptyState, Badge, Pills,
} from '../../components/ui'
import { ProgressSummary } from '../../components/ProjectProgress'

const COPY = {
  all: {
    title: 'All Projects',
    subtitle: 'Every project, whichever services it carries.',
  },
  design: {
    title: 'Design Projects',
    subtitle: 'Projects carrying the Design module — concept, 3D, civil work and BOQ.',
  },
  execution: {
    title: 'Execution Projects',
    subtitle: 'Projects carrying the Execution module — hardscape, softscape, MEP and maintenance.',
  },
  amc: {
    title: 'AMC Projects',
    subtitle: 'Projects under an Annual Maintenance Contract — on its own, or following our design and execution.',
  },
}

export function ProjectList({ scope }: { scope: 'all' | 'design' | 'execution' | 'amc' }) {
  const db = useDb()
  const { can } = usePermissions()
  // Values are Accounts' business; other roles see the projects without them.
  const canSeeMoney = can('Accounts', 'view')
  const [category, setCategory] = useState<ProjectCategory | 'all'>('all')

  const inSection = db.projects.filter((p) => {
    if (scope === 'design') return p.services.design
    if (scope === 'execution') return p.services.execution
    if (scope === 'amc') return p.services.amc || db.maintenance.some((m) => m.projectId === p.id && m.type === 'AMC')
    return true
  })
  const projects = category === 'all' ? inSection : inSection.filter((p) => p.category === category)

  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'
  const managerName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader
        title={COPY[scope].title}
        subtitle={COPY[scope].subtitle}
        actions={
          can('Projects', 'create') && (
            <Link to="/projects/new" className="btn-primary">New Project</Link>
          )
        }
      />

      <div className="mb-4">
        <Pills<ProjectCategory | 'all'>
          active={category}
          onChange={setCategory}
          options={[
            { key: 'all', label: 'All types', count: inSection.length },
            ...PROJECT_CATEGORIES.map((c) => ({ key: c, label: c, count: inSection.filter((p) => p.category === c).length })),
          ]}
        />
      </div>

      {scope === 'amc' && <AmcProjectsTable projects={projects} />}

      {scope !== 'amc' && (
      <Section>
        {projects.length === 0 ? (
          <EmptyState title="No projects here yet." />
        ) : (
          <Table head={['Project', 'Client', 'Site', 'Project Type', 'Manager', ...(canSeeMoney ? ['Value'] : []), 'Progress', 'Status']}>
            {projects.map((project) => (
              <tr key={project.id} className="row-hover">
                <td className="td">
                  <Link to={`/projects/${project.id}`} className="font-medium text-stone-900 hover:text-brand-700">
                    {project.name}
                  </Link>
                  <span className="block text-xs text-stone-400">
                    <span className="font-mono">{project.code}</span> · due {formatDate(project.expectedCompletion)}
                  </span>
                </td>
                <td className="td">{clientName(project.clientId)}</td>
                <td className="td">
                  <SiteName name={project.siteLocation} />
                  {project.area ? <span className="block text-xs text-stone-400">{formatArea(project)}</span> : null}
                </td>
                <td className="td">
                  <span className="block text-sm font-medium text-stone-800">{project.category ?? <span className="text-stone-400">—</span>}</span>
                  <span className="mt-0.5 inline-block"><Badge tone="stone">{projectType(project)}</Badge></span>
                </td>
                <td className="td">{managerName(project.projectManagerId)}</td>
                {canSeeMoney && <td className="td tabular-nums">{formatCurrency(project.value, true)}</td>}
                <td className="td"><ProgressSummary project={project} /></td>
                <td className="td">
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusBadge status={project.status} />
                    {project.delayed && project.status !== 'Completed' && <Badge tone="red">Delayed</Badge>}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
      )}
    </div>
  )
}

/** AMC projects with the contract details that matter day to day: frequency, next visit, renewal. */
function AmcProjectsTable({ projects }: { projects: Project[] }) {
  const db = useDb()
  const canSeeMoney = usePermissions().can('Accounts', 'view')
  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'

  return (
    <Section>
      {projects.length === 0 ? (
        <EmptyState title="No AMC projects yet." hint="Tick AMC when creating a project, or start one from AMC → Contracts." icon="leaf" />
      ) : (
        <Table head={['Project', 'Client', 'Type', 'Visits', 'Next Visit', 'Contract', ...(canSeeMoney ? ['Value'] : []), 'Renewal']}>
          {projects.map((project) => {
            const record = db.maintenance.find((m) => m.projectId === project.id && m.type === 'AMC')
            const next = record && occurrencesFor(record, today()).find((o) => o.status !== 'Done' && o.date >= today())
            const progress = record ? amcProgress(record, today()) : null
            const daysLeft = record?.renewalDate ? daysBetween(today(), record.renewalDate) : null
            return (
              <tr key={project.id} className="row-hover">
                <td className="td">
                  <Link to={`/projects/${project.id}`} className="font-medium text-stone-900 hover:text-brand-700">{project.name}</Link>
                  <span className="block text-xs text-stone-400"><span className="font-mono">{project.code}</span> · <SiteName name={project.siteLocation} />{project.category && ` · ${project.category}`}</span>
                </td>
                <td className="td">{clientName(project.clientId)}</td>
                <td className="td"><Badge tone={project.services.design || project.services.execution ? 'stone' : 'clay'}>{projectType(project)}</Badge></td>
                <td className="td">
                  {record?.schedule ? (
                    <>
                      <span className="block whitespace-nowrap text-sm font-medium text-stone-800">{describeSchedule(record.schedule)}</span>
                      {progress && <span className="text-xs text-stone-400">{progress.done} of {progress.total} done</span>}
                    </>
                  ) : <span className="text-stone-400">No schedule set</span>}
                </td>
                <td className="td whitespace-nowrap tabular-nums">
                  {next ? (next.date === today() ? <Badge tone="amber">Today</Badge> : formatDate(next.date)) : '—'}
                </td>
                <td className="td whitespace-nowrap tabular-nums text-xs">
                  {record ? `${formatDate(record.startDate)} – ${formatDate(record.endDate)}` : '—'}
                </td>
                {canSeeMoney && <td className="td tabular-nums">{record?.value ? formatCurrency(record.value, true) : formatCurrency(project.value, true)}</td>}
                <td className="td">
                  {daysLeft === null ? '—' : daysLeft < 0
                    ? <Badge tone="red">Lapsed</Badge>
                    : daysLeft <= (record?.renewalReminderDays ?? 60)
                      ? <Badge tone="amber">Due in {daysLeft}d</Badge>
                      : <Badge tone="green">{daysLeft} days left</Badge>}
                </td>
              </tr>
            )
          })}
        </Table>
      )}
    </Section>
  )
}
