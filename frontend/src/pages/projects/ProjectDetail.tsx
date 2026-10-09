import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { usePermissions } from '../../state/permissions'
import { CHECKLISTS, checklistProgress, commercialDocs } from '../../domain/commercial'
import { MapPicker, mapsUrl } from '../../components/MapPicker'
import { PhotoGallery } from '../gallery/Gallery'
import { AmcContractCard } from '../amc/AmcContractCard'
import { AmcContractModal } from '../amc/AmcContractForm'
import { can as roleCan } from '../../domain/roles'
import { ProjectChat } from '../../components/ProjectChat'
import { unreadRemarks } from '../../domain/chat'
import { computeProgress, projectType } from '../../domain/progress'
import { formatCurrency, formatDate } from '../../domain/format'
import { MEP_LABELS, MEP_SERVICES, type PhaseKey } from '../../domain/types'
import {
  PageHeader, Section, StatusBadge, SiteName, Table, EmptyState, Badge, ProgressBar, Tabs, Checkbox,
} from '../../components/ui'
import { PhaseStrip, ProjectProgressPanel } from '../../components/ProjectProgress'
import { RepeaterView } from '../../components/RepeaterList'
import { Icon } from '../../components/Icon'

type Tab = 'overview' | 'remarks' | 'phases' | 'tasks' | 'reports' | 'photos' | 'commercial' | 'accounts' | 'maintenance'

export function ProjectDetail() {
  const { projectId = '' } = useParams()
  const db = useDb()
  const { user, roleKey } = useSession()
  const { can } = usePermissions()
  const [pinning, setPinning] = useState(false)
  const [startingAmc, setStartingAmc] = useState(false)
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

  const editable = can('Projects', 'edit')
  const phaseRows: { key: PhaseKey; label: string; progress: number; group: string }[] = [
    ...(progress.design?.phases.map((p) => ({ ...p, group: 'Design' })) ?? []),
    ...(progress.execution?.phases.map((p) => ({ ...p, group: 'Execution' })) ?? []),
  ]

  const docs = commercialDocs(project.services)
  const unread = unreadRemarks(db.projectMessages, db.chatReads, user.id, project.id)
  const photoCount = reports.reduce((s, r) => s + r.photos.length, 0)
  // BOQ is design's to tick, the quotation accounts' or execution's; project editors can do either.
  const canTick = (doc: string) => editable || (doc === 'BOQ' ? can('Design', 'edit') : can('Accounts', 'edit') || can('Execution', 'edit'))

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'remarks', label: 'Remarks', count: unread || undefined },
    { key: 'phases', label: 'Phases', count: phaseRows.length },
    { key: 'tasks', label: 'Tasks', count: tasks.length },
    ...(project.services.execution
      ? [
          { key: 'reports' as Tab, label: 'Daily Reports', count: reports.length },
          { key: 'photos' as Tab, label: 'Site Photos', count: photoCount },
        ]
      : []),
    { key: 'commercial', label: docs.join(' & '), count: docs.reduce((s, d) => s + checklistProgress(project, d).done, 0) },
    { key: 'accounts', label: 'Accounts' },
    ...(maintenance.length || project.services.amc ? [{ key: 'maintenance' as Tab, label: 'AMC', count: maintenance.length || undefined }] : []),
  ]

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{project.code}</span>
            <span className="text-stone-300">·</span>
            {client ? <Link to={`/crm/clients/${client.id}`} className="hover:text-brand-700">{client.name}</Link> : <span>—</span>}
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

      <Tabs<Tab> tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Section title="Project Information" className="lg:col-span-2">
            <dl className="grid gap-x-8 gap-y-4 px-5 py-5 sm:grid-cols-2">
              {[
                ['Client', client
                  ? <Link key="c" to={`/crm/clients/${client.id}`} className="text-brand-700 hover:text-brand-800">{client.name}</Link>
                  : '—'],
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
                {project.services.amc && <Badge tone="clay">AMC</Badge>}
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

          <Section
            title="Site on the Map"
            description={<SiteName name={project.siteLocation} />}
            className="lg:col-span-3"
            actions={
              <div className="flex flex-wrap gap-2">
                {project.siteCoords && (
                  <a href={mapsUrl(project.siteCoords)} target="_blank" rel="noreferrer" className="btn-secondary py-1.5">
                    <Icon name="map" className="h-4 w-4" /> Open in Google Maps
                  </a>
                )}
                {editable && !pinning && (
                  <button onClick={() => setPinning(true)} className="btn-secondary py-1.5">
                    <Icon name="pin" className="h-4 w-4" /> {project.siteCoords ? 'Move pin' : 'Pin the site'}
                  </button>
                )}
                {pinning && <button onClick={() => setPinning(false)} className="btn-primary py-1.5">Done</button>}
              </div>
            }
          >
            <div className="p-4">
              {project.siteCoords || pinning ? (
                <MapPicker
                  key={pinning ? 'edit' : 'view'}
                  value={project.siteCoords}
                  onChange={pinning ? (siteCoords) => api.projects.update(project.id, { siteCoords }) : undefined}
                  initialQuery={project.siteLocation}
                  height={300}
                />
              ) : (
                <EmptyState title="The site has not been pinned on the map yet." hint={editable ? 'Use “Pin the site” to drop a pin.' : undefined} icon="map" />
              )}
            </div>
          </Section>
        </div>
      )}

      {tab === 'photos' && <PhotoGallery projectId={project.id} />}

      {tab === 'remarks' && <ProjectChat projectId={project.id} />}

      {tab === 'commercial' && (
        <div className={`grid gap-6 ${docs.length === 2 ? 'xl:grid-cols-2' : 'max-w-3xl'}`}>
          {docs.map((doc) => {
            const { done, total } = checklistProgress(project, doc)
            const records = db.quotations.filter((q) => q.projectId === project.id && q.kind === doc)
            return (
              <Section
                key={doc}
                title={`${doc} Checklist`}
                description={doc === 'BOQ' ? 'Bill of quantities for the design work.' : 'Priced quotation for the execution work.'}
                actions={<Badge tone={done === total ? 'green' : done ? 'amber' : 'stone'}>{done} / {total}</Badge>}
              >
                <div className="px-5 pt-4"><ProgressBar value={(done / total) * 100} tone={done === total ? 'green' : 'amber'} /></div>
                <ul className="divide-y divide-stone-100 px-2 py-2">
                  {CHECKLISTS[doc].map((item) => {
                    const tick = project.checklist?.[item.id]
                    return (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                        <Checkbox
                          checked={Boolean(tick?.done)}
                          disabled={!canTick(doc)}
                          onChange={(v) => api.projects.setChecklist(project.id, item.id, v, user.id)}
                          label={<span className={tick?.done ? 'text-stone-400 line-through' : ''}>{item.label}</span>}
                        />
                        {tick?.done && tick.on && (
                          <span className="text-xs text-stone-400">
                            {db.employees.find((e) => e.id === tick.by)?.name ?? '—'} · {formatDate(tick.on)}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
                <div className="border-t border-stone-100 px-5 py-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="label">{doc} documents</p>
                    {can('Accounts', 'view') && (
                      <Link to={`/accounts/quotations?project=${project.id}&kind=${doc}`} className="text-xs font-semibold text-brand-700">
                        {can('Accounts', 'create') ? `New ${doc}` : 'View all'}
                      </Link>
                    )}
                  </div>
                  {records.length === 0 ? (
                    <p className="text-sm text-stone-400">No {doc} issued yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {records.map((q) => (
                        <li key={q.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium text-stone-800">{q.number}</span>
                          <span className="flex items-center gap-2">
                            <span className="tabular-nums text-stone-600">{formatCurrency(q.items.reduce((s, i) => s + i.quantity * i.rate, 0))}</span>
                            <StatusBadge status={q.status} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Section>
            )
          })}
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
          {!maintenance.some((m) => m.type === 'AMC') && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-clay-300 bg-clay-50/50 px-5 py-4">
              <p className="text-sm text-clay-900">
                {project.services.amc ? 'AMC is sold on this project but no contract has been set up yet.' : 'No Annual Maintenance Contract on this project yet.'}
              </p>
              {roleCan.manageAmc(roleKey) && (
                <button onClick={() => setStartingAmc(true)} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> Start AMC</button>
              )}
            </div>
          )}
          {maintenance.map((record) => (
            <AmcContractCard key={record.id} record={record} canManage={roleCan.manageAmc(roleKey)} showProject={false} />
          ))}
          {startingAmc && <AmcContractModal projectId={project.id} onClose={() => setStartingAmc(false)} />}
        </div>
      )}

      <Link to="/projects" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <Icon name="back" className="h-4 w-4" /> All projects
      </Link>
    </div>
  )
}
