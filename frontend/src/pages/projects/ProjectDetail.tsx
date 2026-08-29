import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { can } from '../../domain/roles'
import { computeProgress, projectType } from '../../domain/progress'
import { formatCurrency, formatDate } from '../../domain/format'
import { MEP_LABELS, MEP_SERVICES, type PhaseKey } from '../../domain/types'
import {
  PageHeader, Section, StatusBadge, SiteName, Table, EmptyState, Badge, ProgressBar,
} from '../../components/ui'
import { PhaseStrip, ProjectProgressPanel } from '../../components/ProjectProgress'
import { RepeaterView } from '../../components/RepeaterList'
import { Icon } from '../../components/Icon'

type Tab = 'overview' | 'phases' | 'tasks' | 'reports' | 'accounts' | 'maintenance'

export function ProjectDetail() {
  const { projectId = '' } = useParams()
  const db = useDb()
  const { roleKey } = useSession()
  const [tab, setTab] = useState<Tab>('overview')

  const project = db.projects.find((p) => p.id === projectId)
  if (!project) {
    return <EmptyState title="Project not found." hint="It may have been removed." />
  }

  const client = db.clients.find((c) => c.id === project.clientId)
  const manager = db.employees.find((e) => e.id === project.projectManagerId)
  const progress = computeProgress(project)
  const tasks = db.tasks.filter((t) => t.projectId === project.id)
  const reports = db.reports.filter((r) => r.projectId === project.id)
  const requests = db.paymentRequests.filter((r) => r.projectId === project.id)
  const payments = db.payments.filter((p) => p.projectId === project.id)
  const maintenance = db.maintenance.filter((m) => m.projectId === project.id)
  const received = payments.reduce((sum, p) => sum + p.amount, 0)

  const editable = can.createProject(roleKey)
  const phaseRows: { key: PhaseKey; label: string; progress: number; group: string }[] = [
    ...(progress.design?.phases.map((p) => ({ ...p, group: 'Design' })) ?? []),
    ...(progress.execution?.phases.map((p) => ({ ...p, group: 'Execution' })) ?? []),
  ]

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'phases', label: 'Phases', count: phaseRows.length },
    { key: 'tasks', label: 'Tasks', count: tasks.length },
    ...(project.services.execution
      ? [{ key: 'reports' as Tab, label: 'Daily Reports', count: reports.length }]
      : []),
    { key: 'accounts', label: 'Accounts' },
    ...(maintenance.length ? [{ key: 'maintenance' as Tab, label: 'Maintenance' }] : []),
  ]

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{project.code}</span>
            <span className="text-stone-300">·</span>
            <span>{client?.name}</span>
            <span className="text-stone-300">·</span>
            <span><SiteName name={project.siteLocation} /></span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="stone">{projectType(project)}</Badge>
            <StatusBadge status={project.status} />
            {project.delayed && project.status !== 'Completed' && <Badge tone="red">Delayed</Badge>}
          </div>
        }
      />

      <div className="mb-6">
        <PhaseStrip project={project} />
      </div>

      <nav className="mb-5 flex flex-wrap gap-1 border-b border-stone-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-brand-600 text-brand-800'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 text-xs tabular-nums text-stone-400">{t.count}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Section title="Project Information" className="lg:col-span-2">
            <dl className="grid gap-x-8 gap-y-4 px-5 py-5 sm:grid-cols-2">
              {[
                ['Client', client?.name ?? '—'],
                ['Site Location', <SiteName key="s" name={project.siteLocation} />],
                ['Project Manager', manager?.name ?? '—'],
                ['Project Type', projectType(project)],
                ['Start Date', formatDate(project.startDate)],
                ['Expected Completion', formatDate(project.expectedCompletion)],
                ['Contract Value', formatCurrency(project.value)],
                ['Received', formatCurrency(received)],
              ].map(([label, value], i) => (
                <div key={i}>
                  <dt className="label">{label}</dt>
                  <dd className="mt-1 text-sm font-medium text-stone-800">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="border-t border-stone-200 px-5 py-5">
              <p className="label mb-2">Services</p>
              <div className="flex flex-wrap gap-2">
                {project.services.design && <Badge tone="green">Design</Badge>}
                {project.services.execution && <Badge tone="green">Execution</Badge>}
                {project.execution.mep.enabled &&
                  MEP_SERVICES.filter((s) => project.execution.mep.services[s]).map((s) => (
                    <Badge key={s} tone="blue">MEP · {MEP_LABELS[s]}</Badge>
                  ))}
              </div>
            </div>
          </Section>

          <Section title="Progress">
            <div className="px-5 py-5">
              <ProjectProgressPanel project={project} />
            </div>
          </Section>
        </div>
      )}

      {tab === 'phases' && (
        <Section
          title="Phase Progress"
          description={editable ? 'Adjust each phase to reflect what is complete on the ground.' : undefined}
        >
          <Table head={['Module', 'Phase', 'Progress', editable ? 'Adjust' : '']}>
            {phaseRows.map((row) => (
              <tr key={row.key} className="row-hover">
                <td className="td"><Badge tone="stone">{row.group}</Badge></td>
                <td className="td font-medium text-stone-900">
                  {row.label}
                  {row.key === 'maintenance' && (
                    <span className="ml-2 text-xs font-normal text-stone-400">not counted</span>
                  )}
                </td>
                <td className="td">
                  <div className="flex items-center gap-3">
                    <div className="w-40"><ProgressBar value={row.progress} /></div>
                    <span className="w-10 text-right text-sm font-semibold tabular-nums">{row.progress}%</span>
                  </div>
                </td>
                <td className="td">
                  {editable && (
                    <input
                      type="range" min={0} max={100} step={5} value={row.progress}
                      onChange={(e) => api.projects.setPhaseProgress(project.id, row.key, Number(e.target.value))}
                      className="w-32 accent-brand-600"
                      aria-label={`Set ${row.label} progress`}
                    />
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {tab === 'tasks' && (
        <Section title="Tasks">
          {tasks.length === 0 ? (
            <EmptyState title="No tasks on this project yet." />
          ) : (
            <Table head={['Task', 'Phase', 'Assignee', 'Due', 'Priority', 'Status']}>
              {tasks.map((task) => (
                <tr key={task.id} className="row-hover">
                  <td className="td font-medium text-stone-900">
                    {task.title}
                    {task.fromReportId && (
                      <span className="ml-2 text-xs font-normal text-stone-400">from daily report</span>
                    )}
                  </td>
                  <td className="td">{task.phase ?? '—'}</td>
                  <td className="td">{db.employees.find((e) => e.id === task.assigneeId)?.name ?? '—'}</td>
                  <td className="td tabular-nums">{formatDate(task.dueDate)}</td>
                  <td className="td">{task.priority}</td>
                  <td className="td"><StatusBadge status={task.status} /></td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
      )}

      {tab === 'reports' && (
        <Section title="Daily Work Reports">
          {reports.length === 0 ? (
            <EmptyState title="No daily reports filed on this site yet." />
          ) : (
            <ul className="divide-y divide-stone-100">
              {[...reports].sort((a, b) => b.date.localeCompare(a.date)).map((report) => (
                <li key={report.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium tabular-nums text-stone-900">{formatDate(report.date)}</span>
                      <span className="text-sm text-stone-500">
                        {db.employees.find((e) => e.id === report.foremanId)?.name}
                      </span>
                      <span className="text-sm text-stone-400">
                        {report.attendance.filter((a) => a.present).length} workers
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={report.status} />
                      <Link to={`/execution/reports/${report.id}`} className="text-sm font-semibold text-brand-700">
                        Open
                      </Link>
                    </div>
                  </div>
                  <div className="mt-2 pl-1">
                    <RepeaterView values={report.workDone} empty="No work recorded" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {tab === 'accounts' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Section title="Financial Summary">
            <dl className="space-y-3 px-5 py-5">
              {[
                ['Contract Value', formatCurrency(project.value)],
                ['Received', formatCurrency(received)],
                ['Outstanding', formatCurrency(project.value - received)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-sm text-stone-500">{label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-stone-900">{value}</dd>
                </div>
              ))}
              <div className="pt-2">
                <ProgressBar value={project.value ? (received / project.value) * 100 : 0} />
              </div>
            </dl>
          </Section>

          <Section title="Payment Requests" className="lg:col-span-2">
            {requests.length === 0 ? (
              <EmptyState title="No payment requests raised." />
            ) : (
              <Table head={['Phase', 'Amount', 'Requested', 'Status']}>
                {requests.map((request) => (
                  <tr key={request.id} className="row-hover">
                    <td className="td font-medium text-stone-900">{request.phase ?? '—'}</td>
                    <td className="td tabular-nums">{formatCurrency(request.amount)}</td>
                    <td className="td tabular-nums">{formatDate(request.date)}</td>
                    <td className="td"><StatusBadge status={request.status} /></td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="space-y-6">
          {maintenance.map((record) => (
            <Section
              key={record.id}
              title={record.type}
              description={`${formatDate(record.startDate)} – ${formatDate(record.endDate)} · ${record.visitSchedule}`}
              actions={record.renewalDate && (
                <Badge tone="clay">Renews {formatDate(record.renewalDate)}</Badge>
              )}
            >
              <div className="px-5 py-4">
                <p className="label">Scope of Work</p>
                <p className="mt-1 text-sm text-stone-700">{record.scopeOfWork}</p>
              </div>
              <Table head={['Visit Date', 'Team', 'Notes', 'Issues', 'Photos', 'Status']}>
                {record.visits.map((visit) => (
                  <tr key={visit.id} className="row-hover">
                    <td className="td tabular-nums font-medium text-stone-900">{formatDate(visit.date)}</td>
                    <td className="td">
                      {visit.teamIds.map((id) => db.workers.find((w) => w.id === id)?.name).join(', ')}
                    </td>
                    <td className="td max-w-sm">{visit.notes || '—'}</td>
                    <td className="td">{visit.issues.length ? visit.issues.join('; ') : '—'}</td>
                    <td className="td tabular-nums">{visit.photoCount}</td>
                    <td className="td">
                      <StatusBadge status={visit.done ? 'Completed' : 'Scheduled'} />
                    </td>
                  </tr>
                ))}
              </Table>
            </Section>
          ))}
        </div>
      )}

      <Link to="/projects" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <Icon name="back" className="h-4 w-4" /> All projects
      </Link>
    </div>
  )
}
