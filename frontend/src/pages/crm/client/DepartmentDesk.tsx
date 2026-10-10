import { useEffect, useRef, useState } from 'react'
import { api } from '../../../api/client'
import { useDb } from '../../../state/useDb'
import { useSession } from '../../../state/session'
import { formatDate, formatTime, today } from '../../../domain/format'
import type { Clarification, Client, ClientDepartment, DocumentRecord } from '../../../domain/types'
import {
  Section, Table, EmptyState, Badge, StatusBadge, Modal, Field, Avatar, DepartmentBadge,
} from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { SearchSelect } from '../../../components/SearchSelect'
import { projectOptions } from '../../../components/pickerOptions'

/**
 * One department's desk on a client: the clarifications it is handling, the
 * files it has filed, and its internal chat. Each department sees its own.
 */
export function DepartmentDesk({ client, department }: { client: Client; department: ClientDepartment }) {
  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <div className="space-y-6 xl:col-span-3">
        <Clarifications client={client} department={department} />
        <Attachments client={client} department={department} />
      </div>
      <div className="xl:col-span-2">
        <TeamChat client={client} department={department} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- clarifications

function Clarifications({ client, department }: { client: Client; department: ClientDepartment }) {
  const db = useDb()
  const [adding, setAdding] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const items = db.clarifications
    .filter((c) => c.clientId === client.id && c.department === department)
    // Open first, then newest.
    .sort((a, b) => (a.status === b.status ? b.raisedOn.localeCompare(a.raisedOn) : a.status === 'Open' ? -1 : 1))
  const open = items.filter((c) => c.status === 'Open').length

  const staffName = (id?: string) => db.employees.find((e) => e.id === id)?.name ?? '—'
  const projectName = (id?: string) => db.projects.find((p) => p.id === id)?.name

  return (
    <Section
      title={<span className="flex items-center gap-2"><Icon name="help" className="h-4 w-4 text-stone-400" /> {department} Clarifications</span>}
      description={`${open} open · ${items.length - open} resolved`}
      actions={<button onClick={() => setAdding(true)} className="btn-secondary py-1.5">Add</button>}
    >
      {items.length === 0 ? (
        <EmptyState title={`No ${department.toLowerCase()} clarifications.`} />
      ) : (
        <ul className="divide-y divide-stone-100">
          {items.map((c) => (
            <li key={c.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge tone={c.raisedBy === 'Client' ? 'blue' : 'clay'}>
                      {c.raisedBy === 'Client' ? 'Asked by client' : 'Awaiting client'}
                    </Badge>
                    {projectName(c.projectId) && <span className="text-xs text-stone-400">{projectName(c.projectId)}</span>}
                  </div>
                  <p className="text-sm font-medium text-stone-900">{c.question}</p>
                  <p className="mt-0.5 text-xs text-stone-400">
                    Logged by {staffName(c.loggedBy)} · {formatDate(c.raisedOn)}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>

              {c.status === 'Resolved' && c.answer && (
                <div className="mt-3 rounded-lg bg-brand-50 px-3 py-2">
                  <p className="text-sm text-stone-800">{c.answer}</p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {staffName(c.answeredBy)} · {c.answeredOn && formatDate(c.answeredOn)}
                  </p>
                </div>
              )}

              {c.status === 'Open' && (resolvingId === c.id ? (
                <ResolveForm clarification={c} onDone={() => setResolvingId(null)} />
              ) : (
                <button onClick={() => setResolvingId(c.id)} className="mt-2 text-sm font-semibold text-brand-700 hover:text-brand-800">
                  Record answer
                </button>
              ))}
            </li>
          ))}
        </ul>
      )}
      {adding && <ClarificationModal client={client} department={department} onClose={() => setAdding(false)} />}
    </Section>
  )
}

function ResolveForm({ clarification, onDone }: { clarification: Clarification; onDone: () => void }) {
  const { user } = useSession()
  const [answer, setAnswer] = useState('')
  return (
    <div className="mt-3 space-y-2">
      <textarea
        rows={2} className="input" value={answer} autoFocus
        placeholder={clarification.raisedBy === 'Client' ? 'What we told the client…' : 'What the client confirmed…'}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          disabled={!answer.trim()}
          onClick={() => { api.clarifications.resolve(clarification.id, answer.trim(), user.id); onDone() }}
          className="btn-primary py-1.5"
        >
          Mark resolved
        </button>
        <button onClick={onDone} className="btn-ghost py-1.5">Cancel</button>
      </div>
    </div>
  )
}

function ClarificationModal({
  client, department, onClose,
}: { client: Client; department: ClientDepartment; onClose: () => void }) {
  const db = useDb()
  const { user } = useSession()
  const projects = db.projects.filter((p) => p.clientId === client.id)
  const [raisedBy, setRaisedBy] = useState<Clarification['raisedBy']>('Client')
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [question, setQuestion] = useState('')

  const save = () => {
    if (!question.trim()) return
    api.clarifications.create({
      clientId: client.id,
      projectId: projectId || undefined,
      department,
      raisedBy,
      question: question.trim(),
      loggedBy: user.id,
      raisedOn: today(),
    })
    onClose()
  }

  return (
    <Modal
      title={`New ${department} clarification`}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} disabled={!question.trim()} className="btn-primary">Add clarification</button>
      </>}
    >
      <div className="space-y-4">
        <div>
          <p className="label">Raised by</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([['Client', 'The client asked us'], ['Team', 'We need the client to confirm']] as const).map(([key, hint]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRaisedBy(key)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  raisedBy === key ? 'border-brand-500 bg-brand-50' : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <span className="block text-sm font-semibold text-stone-800">{key === 'Client' ? 'Client' : 'Our team'}</span>
                <span className="block text-xs text-stone-500">{hint}</span>
              </button>
            ))}
          </div>
        </div>
        <Field label="Project">
          <SearchSelect
            value={projectId}
            onChange={setProjectId}
            options={projectOptions(db, projects)}
            emptyOption="Not project-specific"
            searchPlaceholder="Search projects"
            title="Project"
          />
        </Field>
        <Field label="Clarification" required>
          <textarea rows={3} className="input" value={question} autoFocus onChange={(e) => setQuestion(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- attachments

/** Best guess at a document category from the file name. */
function categoryFor(fileName: string): DocumentRecord['category'] {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif'].includes(ext)) return 'Photo'
  if (['dwg', 'dxf', 'skp'].includes(ext)) return 'Drawing'
  return 'Other'
}

const sizeLabel = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`)

function Attachments({ client, department }: { client: Client; department: ClientDepartment }) {
  const db = useDb()
  const { user } = useSession()
  const inputRef = useRef<HTMLInputElement>(null)

  const files = db.documents
    .filter((d) => d.clientId === client.id && d.department === department)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))

  const upload = (list: FileList | null) => {
    Array.from(list ?? []).forEach((file) => {
      api.documents.create({
        name: file.name,
        clientId: client.id,
        department,
        category: categoryFor(file.name),
        uploadedBy: user.id,
        uploadedAt: today(),
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
      })
    })
  }

  return (
    <Section
      title={<span className="flex items-center gap-2"><Icon name="clip" className="h-4 w-4 text-stone-400" /> {department} Attachments</span>}
      description="The prototype records the file name and size; production stores the file."
      actions={<>
        <input
          ref={inputRef} type="file" multiple className="hidden"
          onChange={(e) => { upload(e.target.files); e.target.value = '' }}
        />
        <button onClick={() => inputRef.current?.click()} className="btn-secondary py-1.5">
          <Icon name="upload" className="h-4 w-4" /> Upload
        </button>
      </>}
    >
      {files.length === 0 ? (
        <EmptyState title={`No ${department.toLowerCase()} files yet.`} />
      ) : (
        <Table head={['File', 'Category', 'Uploaded By', 'Date', 'Size']}>
          {files.map((doc) => (
            <tr key={doc.id} className="row-hover">
              <td className="td font-medium text-stone-900">{doc.name}</td>
              <td className="td"><Badge tone="stone">{doc.category}</Badge></td>
              <td className="td">{db.employees.find((e) => e.id === doc.uploadedBy)?.name ?? '—'}</td>
              <td className="td tabular-nums">{formatDate(doc.uploadedAt)}</td>
              <td className="td tabular-nums">{sizeLabel(doc.sizeKb)}</td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------- team chat

function stamp(at: string): string {
  const [date, time] = at.split('T')
  return date === today() ? formatTime(time) : `${formatDate(date)} · ${formatTime(time)}`
}

function TeamChat({ client, department }: { client: Client; department: ClientDepartment }) {
  const db = useDb()
  const { user } = useSession()
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const messages = db.chatMessages
    .filter((m) => m.clientId === client.id && m.department === department)
    .sort((a, b) => a.at.localeCompare(b.at))

  // Keep the newest message in view, as any chat would.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages.length, department])

  const send = () => {
    if (!text.trim()) return
    api.chat.post({ clientId: client.id, department, authorId: user.id, text: text.trim() })
    setText('')
  }

  return (
    <Section
      title={<span className="flex items-center gap-2"><Icon name="chat" className="h-4 w-4 text-stone-400" /> {department} Team Chat</span>}
      description="Internal only — the client never sees this."
      className="flex flex-col xl:sticky xl:top-20"
    >
      <div ref={listRef} className="h-[26rem] space-y-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <EmptyState title="No messages yet." hint={`Start the ${department.toLowerCase()} discussion on ${client.name}.`} />
        ) : messages.map((m) => {
          const author = db.employees.find((e) => e.id === m.authorId)
          const mine = m.authorId === user.id
          return (
            <div key={m.id} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
              <Avatar name={author?.name ?? '?'} size="sm" src={author?.photo} />
              <div className={`min-w-0 max-w-[80%] ${mine ? 'text-right' : ''}`}>
                <div className={`flex flex-wrap items-center gap-1.5 ${mine ? 'justify-end' : ''}`}>
                  <span className="text-xs font-semibold text-stone-700">{mine ? 'You' : author?.name}</span>
                  {author && author.department !== department && <DepartmentBadge department={author.department} />}
                  <span className="text-[11px] text-stone-400">{stamp(m.at)}</span>
                </div>
                <p className={`mt-1 inline-block whitespace-pre-wrap rounded-xl px-3 py-2 text-left text-sm ${
                  mine ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-800'
                }`}>
                  {m.text}
                </p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-end gap-2 border-t border-stone-200 p-3">
        <textarea
          rows={1} value={text} placeholder={`Message ${department} team…`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
          }}
          className="input min-h-[40px] resize-none"
          aria-label={`Message the ${department} team`}
        />
        <button onClick={send} disabled={!text.trim()} className="btn-primary shrink-0">Send</button>
      </div>
    </Section>
  )
}
