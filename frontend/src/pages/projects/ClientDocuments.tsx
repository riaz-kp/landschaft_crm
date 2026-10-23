import { useRef, useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { formatDate, today } from '../../domain/format'
import { CLIENT_DOCS, clientDocProgress, type ClientDocItem } from '../../domain/clientDocs'
import type { ClientDocKey, ClientDocTick, Project } from '../../domain/types'
import { Badge, ProgressBar, Section } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { FileLink, uploadDocument } from '../../components/FileLink'

export type DocState = 'Pending' | ClientDocTick['status']
const STATES: DocState[] = ['Pending', 'Received', 'Not Needed']

const STATE_ON: Record<DocState, string> = {
  Pending: 'bg-white text-amber-800 shadow-sm ring-1 ring-amber-300',
  Received: 'bg-brand-600 text-white shadow-sm',
  'Not Needed': 'bg-white text-stone-700 shadow-sm ring-1 ring-stone-300',
}

/** Pending · Received · Not needed, as one segmented control. */
function DocStateToggle({ value, onChange, disabled, label }: { value: DocState; onChange: (s: DocState) => void; disabled?: boolean; label: string }) {
  return (
    <div className="inline-flex shrink-0 rounded-lg bg-stone-100 p-0.5" role="radiogroup" aria-label={label}>
      {STATES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          disabled={disabled}
          onClick={() => onChange(s)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${value === s ? STATE_ON[s] : 'text-stone-500 hover:text-stone-800'} disabled:cursor-not-allowed`}
        >
          {s === 'Not Needed' ? 'Not needed' : s}
        </button>
      ))}
    </div>
  )
}

/** The checklist rows, with "Architectural drawings" heading its three parts. */
function groupedDocs(): { group?: string; items: ClientDocItem[] }[] {
  const out: { group?: string; items: ClientDocItem[] }[] = []
  for (const item of CLIENT_DOCS) {
    const last = out[out.length - 1]
    if (item.group && last?.group === item.group) last.items.push(item)
    else out.push({ group: item.group, items: [item] })
  }
  return out
}

function DocLabel({ item }: { item: ClientDocItem }) {
  return (
    <span className="min-w-0">
      <span className="text-sm font-medium text-stone-800">{item.label}</span>
      <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-500">{item.format}</span>
    </span>
  )
}

/** On New Project: mark what the client has already handed over. */
export function ClientDocsPicker({
  value, onChange,
}: { value: Partial<Record<ClientDocKey, DocState>>; onChange: (key: ClientDocKey, state: DocState) => void }) {
  return (
    <div className="divide-y divide-stone-100">
      {groupedDocs().map(({ group, items }) => (
        <div key={group ?? items[0].key} className="py-2">
          {group && <p className="px-1 pb-1 pt-1 text-xs font-bold uppercase tracking-wider text-stone-400">{group}</p>}
          {items.map((item) => (
            <div key={item.key} className={`flex flex-wrap items-center justify-between gap-2 py-1.5 ${group ? 'pl-3' : ''}`}>
              <DocLabel item={item} />
              <DocStateToggle
                label={item.label}
                value={value[item.key] ?? 'Pending'}
                onChange={(s) => onChange(item.key, s)}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** The project's Client Documents tab: what has come in, when, from whom, and the files themselves. */
export function ClientDocumentsTab({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const db = useDb()
  const { user } = useSession()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadFor, setUploadFor] = useState<ClientDocItem | null>(null)
  const [uploading, setUploading] = useState<ClientDocKey | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const { received, applicable } = clientDocProgress(project)
  const files = db.documents.filter((d) => d.projectId === project.id && d.clientDoc)

  const setState = (key: ClientDocKey, state: DocState, tick?: ClientDocTick) => {
    if (state === 'Pending') api.projects.setClientDoc(project.id, key, null, user.id)
    else api.projects.setClientDoc(project.id, key, { status: state, note: tick?.note, on: tick?.status === state ? tick.on : today() }, user.id)
  }

  const upload = async (list: FileList | null) => {
    const item = uploadFor
    if (!list || !item) return
    setUploadFor(null)
    setUploading(item.key)
    setUploadError(null)
    let stored = 0
    for (const file of Array.from(list)) {
      try {
        const ref = await uploadDocument(file, `projects/${project.id}`)
        api.documents.create({
          name: file.name,
          projectId: project.id,
          clientId: project.clientId,
          // Filed on the client's record too, under the department that uses it.
          department: project.services.design ? 'Design' : 'Execution',
          clientDoc: item.key,
          category: item.category,
          uploadedBy: user.id,
          uploadedAt: today(),
          sizeKb: Math.max(1, Math.round(file.size / 1024)),
          file: ref,
        })
        stored += 1
      } catch (e) {
        setUploadError((e as Error).message)
      }
    }
    setUploading(null)
    // A file in hand means the document has been received.
    const tick = project.clientDocs?.[item.key]
    if (stored && tick?.status !== 'Received') setState(item.key, 'Received', tick)
  }

  return (
    <Section
      title="Client Documents Received"
      description="What the client has handed over to start the work. Mark each one as it comes in, or as not needed on this project."
      actions={<Badge tone={received === applicable ? 'green' : received ? 'amber' : 'stone'}>{received} / {applicable} received</Badge>}
    >
      <input
        ref={inputRef} type="file" multiple className="hidden"
        onChange={(e) => { void upload(e.target.files); e.target.value = '' }}
      />
      {uploadError && <p role="alert" className="mx-5 mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{uploadError}</p>}
      <div className="px-5 pt-4"><ProgressBar value={applicable ? (received / applicable) * 100 : 100} tone={received === applicable ? 'green' : 'amber'} /></div>
      <div className="divide-y divide-stone-100 px-5 py-2">
        {groupedDocs().map(({ group, items }) => (
          <div key={group ?? items[0].key} className="py-2">
            {group && <p className="pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-stone-400">{group}</p>}
            {items.map((item) => {
              const tick = project.clientDocs?.[item.key]
              const state: DocState = tick?.status ?? 'Pending'
              const attached = files.filter((f) => f.clientDoc === item.key)
              const by = tick?.by && db.employees.find((e) => e.id === tick.by)?.name
              return (
                <div key={item.key} className={`py-2.5 ${group ? 'pl-3' : ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <DocLabel item={item} />
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => { setUploadFor(item); inputRef.current?.click() }}
                          disabled={uploading !== null}
                          className="btn-icon h-8 w-8 disabled:opacity-50" title={`Attach the ${item.label.toLowerCase()}`} aria-label={`Attach ${item.label}`}
                        >
                          {uploading === item.key
                            ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                            : <Icon name="clip" className="h-4 w-4" />}
                        </button>
                      )}
                      <DocStateToggle label={item.label} value={state} disabled={!canEdit} onChange={(s) => setState(item.key, s, tick)} />
                    </div>
                  </div>

                  {tick?.status === 'Received' && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                      <span className="flex items-center gap-1.5">
                        Received
                        {canEdit ? (
                          <input
                            type="date" value={tick.on ?? ''} max={today()}
                            onChange={(e) => e.target.value && api.projects.setClientDoc(project.id, item.key, { ...tick, on: e.target.value }, tick.by ?? user.id)}
                            className="input w-auto px-2 py-0.5 text-xs" aria-label={`Date the ${item.label} was received`}
                          />
                        ) : <span className="tabular-nums">{tick.on ? formatDate(tick.on) : '—'}</span>}
                        {by && <span>· logged by {by}</span>}
                      </span>
                      {canEdit ? (
                        <input
                          key={tick.note ?? ''}
                          defaultValue={tick.note ?? ''}
                          onBlur={(e) => e.target.value.trim() !== (tick.note ?? '') && api.projects.setClientDoc(project.id, item.key, { ...tick, note: e.target.value.trim() || undefined }, tick.by ?? user.id)}
                          placeholder="Note — revision, how it came in…"
                          className="input min-w-0 flex-1 px-2 py-0.5 text-xs sm:max-w-sm"
                          aria-label={`Note on the ${item.label}`}
                        />
                      ) : tick.note && <span className="text-stone-600">· {tick.note}</span>}
                    </div>
                  )}

                  {attached.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {attached.map((f) => (
                        <li key={f.id} className="flex items-center gap-1.5 rounded-lg bg-stone-50 px-2 py-1 text-xs text-stone-600 ring-1 ring-inset ring-stone-200">
                          <Icon name="doc" className="h-3.5 w-3.5 text-stone-400" />
                          <FileLink file={f.file} name={f.name} className="max-w-[220px] truncate" />
                          <span className="text-stone-400">{f.sizeKb >= 1024 ? `${(f.sizeKb / 1024).toFixed(1)} MB` : `${f.sizeKb} KB`}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <p className="border-t border-stone-100 px-5 py-3 text-xs text-stone-400">
        Attached files also appear under Documents and on the client's {project.services.design ? 'Design' : 'Execution'} tab. Attaching a file marks the document received.
      </p>
    </Section>
  )
}
