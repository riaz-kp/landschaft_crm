import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { can } from '../../domain/roles'
import { formatCurrency, formatDate } from '../../domain/format'
import { PHASE_LABELS, type DesignPhaseKey } from '../../domain/types'
import {
  PageHeader, Section, StatusBadge, Table, EmptyState, ProgressBar, StatTile,
} from '../../components/ui'

const DESCRIPTIONS: Record<DesignPhaseKey, string> = {
  concept: 'Concept development across every project carrying the design module.',
  threeD: '3D visualisation and client presentation.',
  civilWork: 'Civil drawings and structural detailing.',
  boq: 'Bill of quantities, priced from the approved design.',
}

/** One screen per design phase, listing every project that carries it. */
export function DesignPhasePage({ phase }: { phase: DesignPhaseKey }) {
  const db = useDb()
  const { roleKey } = useSession()
  const editable = can.createProject(roleKey)

  const projects = db.projects.filter((p) => p.services.design && p.design[phase].enabled)
  const complete = projects.filter((p) => p.design[phase].progress === 100)
  const notStarted = projects.filter((p) => p.design[phase].progress === 0)
  const average = projects.length
    ? Math.round(projects.reduce((s, p) => s + p.design[phase].progress, 0) / projects.length)
    : 0

  const phaseTasks = db.tasks.filter((t) => t.phase === phase && t.status !== 'Done')
  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader title={PHASE_LABELS[phase]} subtitle={DESCRIPTIONS[phase]} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Projects" value={projects.length} />
        <StatTile label="Complete" value={complete.length} tone="green" />
        <StatTile label="Not Started" value={notStarted.length} tone="stone" />
        <StatTile label="Average Progress" value={`${average}%`} tone="amber" />
      </div>

      <Section title={`Projects in ${PHASE_LABELS[phase]}`} className="mb-6">
        {projects.length === 0 ? (
          <EmptyState
            title={`No project currently carries ${PHASE_LABELS[phase]}.`}
            hint="Phases are selected per project at creation."
          />
        ) : (
          <Table head={['Project', 'Client', 'Value', 'Progress', editable ? 'Adjust' : '', 'Status']}>
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
                  <div className="flex items-center gap-2">
                    <div className="w-28"><ProgressBar value={project.design[phase].progress} /></div>
                    <span className="w-10 text-right text-sm font-semibold tabular-nums">
                      {project.design[phase].progress}%
                    </span>
                  </div>
                </td>
                <td className="td">
                  {editable && (
                    <input
                      type="range" min={0} max={100} step={5} value={project.design[phase].progress}
                      onChange={(e) => api.projects.setPhaseProgress(project.id, phase, Number(e.target.value))}
                      className="w-28 accent-brand-600"
                      aria-label={`Set ${PHASE_LABELS[phase]} progress for ${project.name}`}
                    />
                  )}
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
                <td className="td"><StatusBadge status={task.status} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  )
}
