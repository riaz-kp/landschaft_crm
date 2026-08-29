import { Link } from 'react-router-dom'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { can } from '../../domain/roles'
import { projectType } from '../../domain/progress'
import { formatCurrency, formatDate } from '../../domain/format'
import {
  PageHeader, Section, StatusBadge, SiteName, Table, EmptyState, Badge,
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
}

export function ProjectList({ scope }: { scope: 'all' | 'design' | 'execution' }) {
  const db = useDb()
  const { roleKey } = useSession()

  const projects = db.projects.filter((p) => {
    if (scope === 'design') return p.services.design
    if (scope === 'execution') return p.services.execution
    return true
  })

  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'
  const managerName = (id: string) => db.employees.find((e) => e.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader
        title={COPY[scope].title}
        subtitle={COPY[scope].subtitle}
        actions={
          can.createProject(roleKey) && (
            <Link to="/projects/new" className="btn-primary">New Project</Link>
          )
        }
      />

      <Section>
        {projects.length === 0 ? (
          <EmptyState title="No projects here yet." />
        ) : (
          <Table head={['Project', 'Client', 'Site', 'Type', 'Manager', 'Value', 'Progress', 'Status']}>
            {projects.map((project) => (
              <tr key={project.id} className="row-hover">
                <td className="td">
                  <Link to={`/projects/${project.id}`} className="font-medium text-stone-900 hover:text-brand-700">
                    {project.name}
                  </Link>
                  <span className="block text-xs text-stone-400">
                    {project.code} · due {formatDate(project.expectedCompletion)}
                  </span>
                </td>
                <td className="td">{clientName(project.clientId)}</td>
                <td className="td"><SiteName name={project.siteLocation} /></td>
                <td className="td"><Badge tone="stone">{projectType(project)}</Badge></td>
                <td className="td">{managerName(project.projectManagerId)}</td>
                <td className="td tabular-nums">{formatCurrency(project.value, true)}</td>
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
    </div>
  )
}
