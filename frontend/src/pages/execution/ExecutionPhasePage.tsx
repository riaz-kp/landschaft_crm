import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { can } from '../../domain/roles'
import { formatDate } from '../../domain/format'
import { MEP_LABELS, MEP_SERVICES, PHASE_LABELS } from '../../domain/types'
import {
  PageHeader, Section, StatusBadge, SiteName, Table, EmptyState, ProgressBar, StatTile, Badge,
} from '../../components/ui'

type Key = 'hardscape' | 'softscape' | 'mep'

const DESCRIPTIONS: Record<Key, string> = {
  hardscape: 'Paving, kerbs, walls, decks and other built elements.',
  softscape: 'Planting, lawns, soil work and plant care.',
  mep: 'Irrigation, electrical and drainage — optional per project.',
}

export function ExecutionPhasePage({ phase }: { phase: Key }) {
  const db = useDb()
  const { roleKey } = useSession()
  const editable = can.createProject(roleKey) || roleKey === 'execution_pm'

  const projects = db.projects.filter(
    (p) => p.services.execution && p.execution[phase].enabled,
  )
  const average = projects.length
    ? Math.round(projects.reduce((s, p) => s + p.execution[phase].progress, 0) / projects.length)
    : 0

  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader title={PHASE_LABELS[phase]} subtitle={DESCRIPTIONS[phase]} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Sites" value={projects.length} />
        <StatTile
          label="Complete"
          value={projects.filter((p) => p.execution[phase].progress === 100).length}
          tone="green"
        />
        <StatTile
          label="In Progress"
          value={projects.filter((p) => {
            const v = p.execution[phase].progress
            return v > 0 && v < 100
          }).length}
          tone="amber"
        />
        <StatTile label="Average Progress" value={`${average}%`} />
      </div>

      <Section title={`Sites in ${PHASE_LABELS[phase]}`}>
        {projects.length === 0 ? (
          <EmptyState
            title={`No site currently carries ${PHASE_LABELS[phase]}.`}
            hint="Execution phases are selected per project at creation."
          />
        ) : (
          <Table head={[
            'Project', 'Client', 'Site',
            ...(phase === 'mep' ? ['Services'] : []),
            'Last Report', 'Progress', editable ? 'Adjust' : '', 'Status',
          ]}>
            {projects.map((project) => {
              const lastReport = db.reports
                .filter((r) => r.projectId === project.id)
                .sort((a, b) => b.date.localeCompare(a.date))[0]
              return (
                <tr key={project.id} className="row-hover">
                  <td className="td">
                    <Link to={`/projects/${project.id}`} className="font-medium text-stone-900 hover:text-brand-700">
                      {project.name}
                    </Link>
                    <span className="block text-xs text-stone-400">{project.code}</span>
                  </td>
                  <td className="td">{clientName(project.clientId)}</td>
                  <td className="td"><SiteName name={project.siteLocation} /></td>
                  {phase === 'mep' && (
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        {MEP_SERVICES.filter((s) => project.execution.mep.services[s]).map((s) => (
                          <Badge key={s} tone="blue">{MEP_LABELS[s]}</Badge>
                        ))}
                      </div>
                    </td>
                  )}
                  <td className="td tabular-nums">
                    {lastReport ? formatDate(lastReport.date) : <span className="text-stone-400">—</span>}
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-28"><ProgressBar value={project.execution[phase].progress} /></div>
                      <span className="w-10 text-right text-sm font-semibold tabular-nums">
                        {project.execution[phase].progress}%
                      </span>
                    </div>
                  </td>
                  <td className="td">
                    {editable && (
                      <input
                        type="range" min={0} max={100} step={5} value={project.execution[phase].progress}
                        onChange={(e) => api.projects.setPhaseProgress(project.id, phase, Number(e.target.value))}
                        className="w-28 accent-brand-600"
                        aria-label={`Set ${PHASE_LABELS[phase]} progress for ${project.name}`}
                      />
                    )}
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={project.status} />
                      {project.delayed && <Badge tone="red">Delayed</Badge>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Section>
    </div>
  )
}
