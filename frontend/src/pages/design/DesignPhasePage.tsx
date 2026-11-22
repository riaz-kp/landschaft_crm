import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import type { Project } from '../../domain/types'
import { useSort } from '../../components/SortControl'
import { usePermissions } from '../../state/permissions'
import { useSession } from '../../state/session'
import { formatCurrency, formatDate } from '../../domain/format'
import { PHASE_LABELS, TASK_STATUS_LABELS, type DesignPhaseKey } from '../../domain/types'
import {
  PageHeader, Section, StatusBadge, Table, EmptyState, StatTile,
} from '../../components/ui'
import { ProgressCell } from '../../components/ProjectProgress'

const DESCRIPTIONS: Record<DesignPhaseKey, string> = {
  concept: 'Concept development across every project carrying the design module. Its payment is the advance.',
  presentation: 'Visualisation and the client presentation.',
  detailing1: 'Design detailing, first phase.',
  detailing2: 'Design detailing, second phase.',
  documentation: 'Working drawings and the documentation handed over for execution.',
}

/** One screen per design phase, listing every project that carries it. */
export function DesignPhasePage({ phase }: { phase: DesignPhaseKey }) {
  const db = useDb()
  const { user } = useSession()
  const { can } = usePermissions()
  const editable = can('Design', 'edit')

  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'
  const { sort, control: sortControl } = useSort<Project>('design-phase', [
    { key: 'name', label: 'Project', value: (p) => p.name },
    { key: 'client', label: 'Client', value: (p) => clientName(p.clientId) },
    { key: 'progress', label: 'Progress', value: (p) => p.design[phase].progress, dir: 'desc' },
    { key: 'due', label: 'Due date', value: (p) => p.expectedCompletion },
    { key: 'status', label: 'Status', value: (p) => p.status },
  ])
  const projects = sort(db.projects.filter((p) => p.services.design && p.design[phase].enabled))
  const complete = projects.filter((p) => p.design[phase].progress === 100)
  const notStarted = projects.filter((p) => p.design[phase].progress === 0)
  const average = projects.length
    ? Math.round(projects.reduce((s, p) => s + p.design[phase].progress, 0) / projects.length)
    : 0

  const phaseTasks = db.tasks.filter((t) => t.phase === phase && t.status !== 'Done')

  return (
    <div>
      <PageHeader title={PHASE_LABELS[phase]} subtitle={DESCRIPTIONS[phase]} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Projects" value={projects.length} />
        <StatTile label="Complete" value={complete.length} tone="green" />
        <StatTile label="Not Started" value={notStarted.length} tone="stone" />
        <StatTile label="Average Progress" value={`${average}%`} tone="amber" />
      </div>

      <Section title={`Projects in ${PHASE_LABELS[phase]}`} className="mb-6" actions={projects.length > 1 && sortControl}>
        {projects.length === 0 ? (
          <EmptyState
            title={`No project currently carries ${PHASE_LABELS[phase]}.`}
            hint="Phases are selected per project at creation."
          />
        ) : (
          <Table head={['Project', 'Client', 'Value', 'Progress', 'Status']}>
            {projects.map((project) => (
              <tr key={project.id} className="row-hover">
                <td className="td">
                  <Link to={`/projects/${project.id}`} className="font-medium text-stone-900 hover:text-brand-700">
                    {project.name}
                  </Link>
                  <span className="block text-xs text-stone-400">{project.code}</span>
                </td>
                <td className="td">{clientName(project.clientId)}</td>
                <td className="td tabular-nums">{formatCurrency(project.value, true)}</td>
                <td className="td">
                  <ProgressCell
                    value={project.design[phase].progress}
                    label={`${PHASE_LABELS[phase]} for ${project.name}`}
                    onChange={editable ? (v) => api.projects.setPhaseProgress(project.id, phase, v, user.id) : undefined}
                  />
                </td>
                <td className="td"><StatusBadge status={project.status} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title="Open Tasks in this Phase">
        {phaseTasks.length === 0 ? (
          <EmptyState title="No open tasks in this phase." />
        ) : (
          <Table head={['Task', 'Project', 'Assignee', 'Due', 'Status']}>
            {phaseTasks.map((task) => (
              <tr key={task.id} className="row-hover">
                <td className="td font-medium text-stone-900">{task.title}</td>
                <td className="td">{db.projects.find((p) => p.id === task.projectId)?.name}</td>
                <td className="td">{db.employees.find((e) => e.id === task.assigneeId)?.name}</td>
                <td className="td tabular-nums">{formatDate(task.dueDate)}</td>
                <td className="td"><StatusBadge status={task.status} label={TASK_STATUS_LABELS[task.status]} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  )
}
