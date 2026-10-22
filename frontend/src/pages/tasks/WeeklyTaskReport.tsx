import { useState } from 'react'
import { useDb } from '../../state/useDb'
import type { DbShape } from '../../mock/store'
import { daysBetween, today } from '../../domain/format'
import type { DateRange } from '../../domain/period'
import { titleOf } from '../../domain/roles'
import { PHASE_LABELS, type ID, type ProjectLogEntry, type Task } from '../../domain/types'
import { Modal, StatTile } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { WeekPicker, weekLabel, weekOf } from '../../components/WeekPicker'
import { excelDate, exportWorkbook, sheet } from '../../components/excel'

/** The day a finished task was closed — older records without one count from their due date. */
const doneDate = (t: Task) => (t.status === 'Done' ? t.doneOn ?? t.dueDate : undefined)
const within = (date: string | undefined, week: DateRange) => Boolean(date && date >= week.from && date <= week.to)

export interface WeeklyTaskData {
  dueThisWeek: Task[]
  doneThisWeek: Task[]
  /** Due on or before the week's last day and still not done when the week ended. */
  openAtWeekEnd: Task[]
  reassignments: ProjectLogEntry[]
}

/** Which tasks and hand-overs a weekly report covers. */
export interface WeeklyTaskScope {
  tasks: Task[]
  label: string
  /**
   * The people the report is about. A task they handed over has left their
   * list, but the hand-over still belongs in their week.
   */
  people?: ID[]
  projectId?: ID
}

/**
 * A week of tasks: what fell due, what was finished (with its done note), what
 * was still open when the week ended, and every hand-over.
 */
export function weeklyTaskData(db: DbShape, scope: WeeklyTaskScope, week: DateRange): WeeklyTaskData {
  const { tasks, people, projectId } = scope
  const taskIds = new Set(tasks.map((t) => t.id))
  const covers = (l: ProjectLogEntry) =>
    (l.taskId !== undefined && taskIds.has(l.taskId))
    || (people !== undefined && (!projectId || l.projectId === projectId) && [l.fromId, l.toId].some((id) => id && people.includes(id)))
  return {
    dueThisWeek: tasks.filter((t) => within(t.dueDate, week)),
    doneThisWeek: tasks.filter((t) => within(doneDate(t), week)),
    openAtWeekEnd: tasks.filter((t) => t.dueDate <= week.to && !(doneDate(t) && doneDate(t)! <= week.to)),
    reassignments: db.projectLog.filter((l) => l.kind === 'task-reassigned' && within(l.at.slice(0, 10), week) && covers(l)),
  }
}

async function exportWeeklyTasks(db: DbShape, data: WeeklyTaskData, week: DateRange, scopeLabel: string) {
  const person = (id?: ID) => db.employees.find((e) => e.id === id)
  const personName = (id?: ID) => person(id)?.name ?? ''
  const project = (id: ID) => db.projects.find((p) => p.id === id)
  const taskTitle = (l: ProjectLogEntry) => db.tasks.find((t) => t.id === l.taskId)?.title ?? l.title
  const asAt = week.to < today() ? week.to : today()

  // One row per person who had anything happen in the week.
  const people = [...new Set([
    ...data.dueThisWeek, ...data.doneThisWeek, ...data.openAtWeekEnd,
  ].map((t) => t.assigneeId).concat(data.reassignments.flatMap((l) => [l.fromId ?? '', l.toId ?? ''])))].filter(Boolean)
  const byPerson = people.map((id) => ({
    id,
    due: data.dueThisWeek.filter((t) => t.assigneeId === id).length,
    done: data.doneThisWeek.filter((t) => t.assigneeId === id).length,
    onTime: data.doneThisWeek.filter((t) => t.assigneeId === id && doneDate(t)! <= t.dueDate).length,
    open: data.openAtWeekEnd.filter((t) => t.assigneeId === id).length,
    overdue: data.openAtWeekEnd.filter((t) => t.assigneeId === id && t.dueDate < asAt).length,
    received: data.reassignments.filter((l) => l.toId === id).length,
    handedOver: data.reassignments.filter((l) => l.fromId === id).length,
  })).sort((a, b) => personName(a.id).localeCompare(personName(b.id)))

  const taskColumns = [
    { header: 'Task', value: (t: Task) => t.title, width: 42 },
    { header: 'Project', value: (t: Task) => project(t.projectId)?.name ?? '', width: 30 },
    { header: 'Code', value: (t: Task) => project(t.projectId)?.code ?? '', width: 13 },
    { header: 'Phase', value: (t: Task) => (t.phase ? PHASE_LABELS[t.phase] : ''), width: 15 },
    { header: 'Assignee', value: (t: Task) => personName(t.assigneeId), width: 16 },
    { header: 'Priority', value: (t: Task) => t.priority, width: 10 },
  ]

  await exportWorkbook(`Weekly tasks ${week.from} to ${week.to}`, [
    sheet({
      name: 'Summary',
      rows: [
        ['Report', 'Landschaft CRM — weekly task report'], ['Week', weekLabel(week)], ['Covers', scopeLabel],
        ['Generated', excelDate(today())], ['Tasks due this week', data.dueThisWeek.length],
        ['Tasks done this week', data.doneThisWeek.length],
        ['Done with a note', data.doneThisWeek.filter((t) => t.doneNote).length],
        ['Open at week end', data.openAtWeekEnd.length],
        ['Overdue at week end', data.openAtWeekEnd.filter((t) => t.dueDate < asAt).length],
        ['Reassignments', data.reassignments.length],
      ] as [string, unknown][],
      columns: [
        { header: 'Measure', value: (r: [string, unknown]) => r[0], width: 26 },
        { header: 'Value', value: (r: [string, unknown]) => r[1] as never, width: 48 },
      ],
    }),
    sheet({
      name: 'By Person',
      rows: byPerson,
      columns: [
        { header: 'Person', value: (r) => personName(r.id), width: 18 },
        { header: 'Role', value: (r) => { const p = person(r.id); return p ? titleOf(p) : '' }, width: 26 },
        { header: 'Due this week', value: (r) => r.due, width: 13 },
        { header: 'Done this week', value: (r) => r.done, width: 14 },
        { header: 'Done on time', value: (r) => r.onTime, width: 13 },
        { header: 'Open at week end', value: (r) => r.open, width: 16 },
        { header: 'Overdue', value: (r) => r.overdue, width: 10 },
        { header: 'Reassigned to them', value: (r) => r.received, width: 18 },
        { header: 'Handed over', value: (r) => r.handedOver, width: 12 },
      ],
    }),
    sheet({
      name: 'Done This Week',
      rows: [...data.doneThisWeek].sort((a, b) => doneDate(a)!.localeCompare(doneDate(b)!)),
      columns: [
        { header: 'Done on', value: (t: Task) => excelDate(doneDate(t)), width: 12 },
        ...taskColumns,
        { header: 'Due', value: (t: Task) => excelDate(t.dueDate), width: 12 },
        { header: 'On time', value: (t: Task) => doneDate(t)! <= t.dueDate, width: 9 },
        { header: 'Marked done by', value: (t: Task) => personName(t.doneBy ?? t.assigneeId), width: 16 },
        { header: 'Done note', value: (t: Task) => t.doneNote ?? '', width: 60 },
      ],
    }),
    sheet({
      name: 'Due This Week',
      rows: [...data.dueThisWeek].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      columns: [
        { header: 'Due', value: (t: Task) => excelDate(t.dueDate), width: 12 },
        ...taskColumns,
        { header: 'Status', value: (t: Task) => t.status, width: 12 },
        { header: 'Done on', value: (t: Task) => excelDate(doneDate(t)), width: 12 },
        { header: 'Done note', value: (t: Task) => t.doneNote ?? '', width: 50 },
      ],
    }),
    sheet({
      name: 'Open at Week End',
      rows: [...data.openAtWeekEnd].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      columns: [
        { header: 'Due', value: (t: Task) => excelDate(t.dueDate), width: 12 },
        ...taskColumns,
        { header: 'Status now', value: (t: Task) => t.status, width: 12 },
        { header: 'Days overdue', value: (t: Task) => Math.max(0, daysBetween(t.dueDate, asAt)), width: 13 },
      ],
    }),
    sheet({
      name: 'Reassignments',
      rows: [...data.reassignments].sort((a, b) => a.at.localeCompare(b.at)),
      columns: [
        { header: 'Date', value: (l) => excelDate(l.at), width: 12 },
        { header: 'Time', value: (l) => l.at.slice(11, 16), width: 8 },
        { header: 'Task', value: (l) => taskTitle(l), width: 42 },
        { header: 'Project', value: (l) => project(l.projectId)?.name ?? '', width: 30 },
        { header: 'From', value: (l) => personName(l.fromId), width: 16 },
        { header: 'To', value: (l) => personName(l.toId), width: 16 },
        { header: 'Reassigned by', value: (l) => personName(l.byId), width: 16 },
        { header: 'Reason', value: (l) => l.detail ?? '', width: 48 },
      ],
    }),
  ])
}

/** Picks a week, shows what it held, and downloads the weekly task workbook. */
export function WeeklyTaskReportModal({ scope, onClose }: { scope: WeeklyTaskScope; onClose: () => void }) {
  const db = useDb()
  const [week, setWeek] = useState(() => weekOf(today()))
  const [exporting, setExporting] = useState(false)
  const data = weeklyTaskData(db, scope, week)
  const scopeLabel = scope.label

  const download = async () => {
    setExporting(true)
    try {
      await exportWeeklyTasks(db, data, week, scopeLabel)
      onClose()
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal
      title="Weekly task report"
      size="lg"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={download} disabled={exporting} className="btn-primary">
          <Icon name="upload" className="h-4 w-4 rotate-180" /> {exporting ? 'Preparing…' : 'Download Excel'}
        </button>
      </>}
    >
      <div className="space-y-4">
        <WeekPicker week={week} onChange={setWeek} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Due" value={data.dueThisWeek.length} icon="calendar" />
          <StatTile label="Done" value={data.doneThisWeek.length} tone="green" icon="check" sub={`${data.doneThisWeek.filter((t) => t.doneNote).length} with a note`} />
          <StatTile label="Open at End" value={data.openAtWeekEnd.length} tone={data.openAtWeekEnd.length ? 'amber' : 'stone'} icon="clock" />
          <StatTile label="Reassigned" value={data.reassignments.length} tone="violet" icon="repeat" />
        </div>
        <p className="text-sm text-stone-500">
          Covers <strong className="text-stone-700">{scopeLabel}</strong>. The workbook has a summary, a sheet per person,
          tasks done in the week with their done notes, tasks due, tasks still open when the week ended, and every reassignment with its reason.
        </p>
      </div>
    </Modal>
  )
}
