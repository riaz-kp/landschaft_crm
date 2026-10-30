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
import { formatCurrency, formatDate, today } from '../../domain/format'
import { MEP_LABELS, MEP_SERVICES, PHASE_LABELS, type PhaseKey, type Task, type TaskStatus } from '../../domain/types'
import { clientDocProgress } from '../../domain/clientDocs'
import { formatArea } from '../../domain/projectInfo'
import {
  PageHeader, Section, StatusBadge, SiteName, Table, EmptyState, Badge, ProgressBar, Tabs, Checkbox, RowActions,
} from '../../components/ui'
import { ProjectEditModal } from './ProjectEditModal'
import { ClientDocumentsTab } from './ClientDocuments'
import { ClientBriefTab } from './ClientBriefTab'
import { briefFor } from '../../domain/clientBrief'
import { ProjectHistory } from './ProjectHistory'
import { TASK_STATUSES, TaskDoneModal, TaskFormModal, TaskReassignModal } from '../tasks/TaskForm'
import { PhaseStrip, ProgressCell, ProjectProgressPanel } from '../../components/ProjectProgress'
import { RepeaterView } from '../../components/RepeaterList'
import { Icon } from '../../components/Icon'
import { PeoplePicker } from '../../components/PeoplePicker'
import { PaymentSchedule, WorkflowTab } from './WorkflowTab'
import { nextStep, workflowFor } from '../../domain/workflow'

type Tab = 'overview' | 'workflow' | 'remarks' | 'phases' | 'tasks' | 'documents' | 'brief' | 'reports' | 'photos' | 'commercial' | 'accounts' | 'maintenance' | 'history'

export function ProjectDetail() {
  const { projectId = '' } = useParams()
  const db = useDb()
  const { user, roleKey } = useSession()
  const { can } = usePermissions()
  const [pinning, setPinning] = useState(false)
  const [startingAmc, setStartingAmc] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [editingDetails, setEditingDetails] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | 'new' | null>(null)
  const [finishing, setFinishing] = useState<Task | null>(null)
  const [reassigning, setReassigning] = useState<Task | null>(null)

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
  const canAssignForemen = editable || can('Execution', 'edit')
  const siteForemen = db.siteAssignments.filter((a) => a.projectId === project.id).map((a) => a.foremanId)
  const phaseRows: { key: PhaseKey; label: string; progress: number; group: string }[] = [
    ...(progress.design?.phases.map((p) => ({ ...p, group: 'Design' })) ?? []),
    ...(progress.execution?.phases.map((p) => ({ ...p, group: 'Execution' })) ?? []),
  ]

  const docs = commercialDocs(project.services)
  const unread = unreadRemarks(db.projectMessages, db.chatReads, user.id, project.id)
  const photoCount = reports.reduce((s, r) => s + r.photos.length, 0)
  // BOQ is design's to tick, the quotation accounts' or execution's; project editors can do either.
  const canTick = (doc: string) => editable || (doc === 'BOQ' ? can('Design', 'edit') : can('Accounts', 'edit') || can('Execution', 'edit'))
  const canEditDocs = editable || can('Design', 'edit') || can('Execution', 'edit')
  const docProgress = clientDocProgress(project)
  const brief = briefFor(db.clientBriefs, project.id)
  const canEditTask = (t: Task) => can('Tasks', 'edit') || t.assigneeId === user.id
  const steps = workflowFor(project)
  const next = nextStep(project)

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    ...(steps.length ? [{ key: 'workflow' as Tab, label: 'Workflow', count: steps.filter((s) => project.workflow?.[s.key]?.done).length }] : []),
    { key: 'remarks', label: 'Remarks', count: unread || undefined },
    { key: 'phases', label: 'Phases', count: phaseRows.length },
    { key: 'tasks', label: 'Tasks', count: tasks.length },
    { key: 'documents', label: 'Client Documents', count: docProgress.received },
    { key: 'brief', label: 'Client Checklist' },
    ...(project.services.execution
      ? [
          { key: 'reports' as Tab, label: 'Daily Reports', count: reports.length },
          { key: 'photos' as Tab, label: 'Site Photos', count: photoCount },
        ]
      : []),
    { key: 'commercial', label: docs.join(' & '), count: docs.reduce((s, d) => s + checklistProgress(project, d).done, 0) },
    { key: 'accounts', label: 'Accounts' },
    ...(maintenance.length || project.services.amc ? [{ key: 'maintenance' as Tab, label: 'AMC', count: maintenance.length || undefined }] : []),
    { key: 'history', label: 'History' },
  ]

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="rounded-md bg-stone-100 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-stone-700">{project.code}</span>
            <span className="text-stone-300">·</span>
            {client ? <Link to={`/crm/clients/${client.id}`} className="hover:text-brand-700">{client.name}</Link> : <span>—</span>}
            <span className="text-stone-300">·</span>
            <span><SiteName name={project.siteLocation} /></span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {project.category && <Badge tone="blue">{project.category}</Badge>}
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
          <Section
            title="Project Information"
            className="lg:col-span-2"
            actions={editable && (
              <button onClick={() => setEditingDetails(true)} className="btn-secondary py-1.5">
                <Icon name="edit" className="h-4 w-4" /> Edit project
              </button>
            )}
          >
            <dl className="grid gap-x-8 gap-y-4 px-5 py-5 sm:grid-cols-2">
              {[
                ['Project Code', <span key="code" className="font-mono tracking-wide">{project.code}</span>],
                ['Project Type', project.category ?? <span key="t" className="text-stone-400">Not set</span>],
                ['Client', client
                  ? <Link key="c" to={`/crm/clients/${client.id}`} className="text-brand-700 hover:text-brand-800">{client.name}</Link>
                  : '—'],
                ['Site Location', <SiteName key="s" name={project.siteLocation} />],
                ['Project Manager', manager?.name ?? '—'],
                ['Services', projectType(project)],
                ['Site Area', formatArea(project) || <span key="a" className="text-stone-400">Not recorded</span>],
                ['Client Documents', (
                  <button key="docs" onClick={() => setTab('documents')} className="text-left hover:text-brand-700">
                    {docProgress.received} of {docProgress.applicable} received
                    {docProgress.pending > 0 && <span className="ml-1.5"><Badge tone="amber">{docProgress.pending} pending</Badge></span>}
                  </button>
                )],
                ['Client Checklist', (
                  <button key="brief" onClick={() => setTab('brief')} className="text-left hover:text-brand-700">
                    {brief
                      ? <>Received {formatDate(brief.submittedAt.slice(0, 10))}</>
                      : project.briefToken ? <Badge tone="amber">Waiting for client</Badge> : <span className="text-stone-400">Not sent yet</span>}
                  </button>
                )],
                ['Start Date', formatDate(project.startDate)],
                ['Expected Completion', formatDate(project.expectedCompletion)],
                ['Project Value', formatCurrency(project.value)],
                ['Received', formatCurrency(received)],
                ['Client Budget', project.budget ? formatCurrency(project.budget) : <span key="b" className="text-stone-400">Not recorded</span>],
                ['Proposed Fee Basis', project.feeBasis ?? <span key="f" className="text-stone-400">Not set</span>],
                ['Next Action', project.nextAction ?? <span key="n" className="text-stone-400">Not set</span>],
                ...(project.services.design
                  ? [['Site Visit Before Proposal', project.siteVisitRequired ? <Badge key="v" tone="amber">Required</Badge> : 'Not required']]
                  : []),
              ].map(([label, value], i) => (
                <div key={i}>
                  <dt className="label">{label}</dt>
                  <dd className="mt-1 text-sm font-medium text-stone-800">{value}</dd>
                </div>
              ))}
            </dl>

            {project.requirement && (
              <div className="border-t border-stone-200 px-5 py-5">
                <p className="label mb-1">Preliminary Requirement</p>
                <p className="whitespace-pre-line text-sm text-stone-800">{project.requirement}</p>
              </div>
            )}

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

          <div className="space-y-6">
            {steps.length > 0 && (
              <Section title="Workflow" actions={<button onClick={() => setTab('workflow')} className="text-xs font-semibold text-brand-700">Open</button>}>
                <div className="px-5 py-4">
                  {next ? (
                    <>
                      <p className="label">Next step</p>
                      <p className="mt-1 text-sm font-medium text-stone-900">{next.label}</p>
                    </>
                  ) : (
                    <p className="flex items-center gap-1.5 text-sm font-medium text-brand-700"><Icon name="check" className="h-4 w-4" /> Every hand-off done</p>
                  )}
                  <p className="mt-2 text-xs text-stone-500">{steps.filter((s) => project.workflow?.[s.key]?.done).length} of {steps.length} steps done</p>
                </div>
              </Section>
            )}
            <Section title="Progress">
              <div className="px-5 py-5">
                <ProjectProgressPanel project={project} />
              </div>
            </Section>
          </div>

          {project.services.execution && (
            <Section
              title="Site Foremen"
              description="Foremen on this site see it under My Sites on their phone, and file its daily work report."
              className="lg:col-span-3"
            >
              <div className="px-5 py-4">
                {canAssignForemen ? (
                  <PeoplePicker
                    value={siteForemen}
                    onChange={(ids) => api.projects.setForemen(project.id, ids)}
                    people={db.employees.filter((e) => e.role === 'foreman')}
                    placeholder="Add a foreman to this site…"
                    title="Add a foreman"
                  />
                ) : siteForemen.length ? (
                  <p className="text-sm text-stone-700">{siteForemen.map((id) => db.employees.find((e) => e.id === id)?.name).join(', ')}</p>
                ) : null}
                {siteForemen.length === 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-700">
                    <Icon name="alert" className="h-4 w-4" /> No foreman yet — nobody can file a daily report for this site.
                  </p>
                )}
              </div>
            </Section>
          )}

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

      {tab === 'workflow' && <WorkflowTab project={project} />}

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
          description={editable ? 'Use the pencil beside a phase to update what is complete on the ground.' : undefined}
        >
          <Table head={['Phase', 'Module', 'Progress']}>
            {phaseRows.map((row) => (
              <tr key={row.key} className="row-hover">
                <td className="td font-medium text-stone-900">
                  {row.label}
                  {row.key === 'maintenance' && (
                    <span className="ml-2 text-xs font-normal text-stone-400">not counted</span>
                  )}
                </td>
                <td className="td"><Badge tone="stone">{row.group}</Badge></td>
                <td className="td">
                  <ProgressCell
                    value={row.progress}
                    label={row.label}
                    onChange={editable ? (v) => api.projects.setPhaseProgress(project.id, row.key, v) : undefined}
                  />
                </td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {tab === 'tasks' && (
        <Section
          title="Tasks"
          description="Reassigning a task or marking it done with a note is kept in the project's History."
          actions={can('Tasks', 'create') && (
            <button onClick={() => setEditingTask('new')} className="btn-primary py-1.5"><Icon name="plus" className="h-4 w-4" /> New task</button>
          )}
        >
          {tasks.length === 0 ? (
            <EmptyState title="No tasks on this project yet." />
          ) : (
            <Table head={['Task', 'Phase', 'Assignee', 'Due', 'Priority', 'Status', '']}>
              {[...tasks].sort((a, b) => (a.status === 'Done' ? 1 : 0) - (b.status === 'Done' ? 1 : 0) || a.dueDate.localeCompare(b.dueDate)).map((task) => {
                const overdue = task.status !== 'Done' && task.dueDate < today()
                return (
                  <tr key={task.id} className="row-hover">
                    <td className="td">
                      <button onClick={() => canEditTask(task) && setEditingTask(task)} className="text-left">
                        <span className={`font-medium ${task.status === 'Done' ? 'text-stone-400 line-through' : 'text-stone-900'} hover:text-brand-700`}>{task.title}</span>
                      </button>
                      {task.fromReportId && (
                        <span className="ml-2 text-xs font-normal text-stone-400">from daily report</span>
                      )}
                      {task.status === 'Done' && task.doneNote && (
                        <span className="mt-1 flex items-start gap-1 text-xs text-stone-500">
                          <Icon name="check" className="mt-px h-3 w-3 shrink-0 text-brand-600" /> {task.doneNote}
                        </span>
                      )}
                    </td>
                    <td className="td">{task.phase ? PHASE_LABELS[task.phase] : '—'}</td>
                    <td className="td">{db.employees.find((e) => e.id === task.assigneeId)?.name ?? '—'}</td>
                    <td className={`td whitespace-nowrap tabular-nums ${overdue ? 'font-semibold text-red-700' : ''}`}>{formatDate(task.dueDate)}</td>
                    <td className="td">{task.priority}</td>
                    <td className="td">
                      <select
                        value={task.status}
                        disabled={!canEditTask(task)}
                        onChange={(e) => {
                          const status = e.target.value as TaskStatus
                          if (status === 'Done') setFinishing(task)
                          else api.tasks.setStatus(task.id, status, user.id)
                        }}
                        className="input w-32 py-1 text-xs"
                        aria-label={`Status for ${task.title}`}
                      >
                        {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="td">
                      <RowActions
                        extra={canEditTask(task) && task.status !== 'Done' && (
                          <button type="button" onClick={() => setReassigning(task)} className="btn-icon" title="Reassign" aria-label={`Reassign ${task.title}`}>
                            <Icon name="repeat" className="h-4 w-4" />
                          </button>
                        )}
                        onEdit={canEditTask(task) ? () => setEditingTask(task) : undefined}
                      />
                    </td>
                  </tr>
                )
              })}
            </Table>
          )}
        </Section>
      )}

      {tab === 'documents' && <ClientDocumentsTab project={project} canEdit={canEditDocs} />}

      {tab === 'brief' && <ClientBriefTab project={project} canManage={canEditDocs} />}

      {tab === 'history' && <ProjectHistory projectId={project.id} />}

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
                ['Project Value', formatCurrency(project.value)],
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

          {(project.services.design || project.services.execution) && (
            <PaymentSchedule project={project} received={received} canEdit={editable || can('Accounts', 'edit')} />
          )}
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

      {editingDetails && <ProjectEditModal project={project} onClose={() => setEditingDetails(false)} />}
      {editingTask && (
        <TaskFormModal
          task={editingTask === 'new' ? undefined : editingTask}
          defaults={{ projectId: project.id }}
          onClose={() => setEditingTask(null)}
        />
      )}
      {finishing && <TaskDoneModal task={finishing} onClose={() => setFinishing(null)} />}
      {reassigning && <TaskReassignModal task={reassigning} onClose={() => setReassigning(null)} />}

      <Link to="/projects" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <Icon name="back" className="h-4 w-4" /> All projects
      </Link>
    </div>
  )
}
