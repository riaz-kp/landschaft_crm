import { useRef, useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { formatDate, formatDateLong, today } from '../../domain/format'
import type { AmcOccurrence } from '../../domain/amc'
import type { ID, VisitFile, VisitPhoto } from '../../domain/types'
import { Field, FormError, Modal } from '../../components/ui'
import { RepeaterList } from '../../components/RepeaterList'
import { Icon } from '../../components/Icon'
import { StoredImg } from '../../components/StoredImage'
import { Lightbox } from '../../components/Lightbox'
import { FileLink, LinkField, uploadDocument } from '../../components/FileLink'
import { compressImage } from '../../components/imageResize'
import { isLink, storePhoto } from '../../data/files'
import { AmcTeamPicker } from './AmcTeamPicker'

/**
 * Photos and documents on a visit report. Photos are shrunk on the phone like
 * a daily report's; both are stored in the file bucket and shown to the client
 * on the AMC report link.
 */
function VisitAttachments({
  photos, files, onPhotos, onFiles, onBusy,
}: {
  photos: VisitPhoto[]; files: VisitFile[]
  onPhotos: (next: VisitPhoto[]) => void; onFiles: (next: VisitFile[]) => void
  onBusy: (busy: boolean) => void
}) {
  const { settings } = useDb()
  const photoRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'photos' | 'files' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [linking, setLinking] = useState(false)

  const run = async (kind: 'photos' | 'files', list: FileList | null, each: (file: File) => Promise<void>) => {
    if (!list?.length) return
    setBusy(kind)
    onBusy(true)
    setError(null)
    for (const file of Array.from(list)) {
      try {
        await each(file)
      } catch (e) {
        setError(e instanceof Error && e.message.startsWith('Upload failed')
          ? `${file.name} could not be uploaded. Check the connection and try again.`
          : e instanceof Error && kind === 'files' ? e.message : `${file.name} could not be read as an image.`)
      }
    }
    setBusy(null)
    onBusy(false)
  }

  const addPhotos = (list: FileList | null) => {
    const added: VisitPhoto[] = []
    void run('photos', list, async (file) => {
      const shot = await compressImage(file, settings.photoMaxPx, settings.photoMaxKb)
      added.push({ id: `vp${crypto.randomUUID().slice(0, 12)}`, src: await storePhoto(shot.dataUrl, 'amc') })
    }).then(() => added.length && onPhotos([...photos, ...added]))
  }

  const addFiles = (list: FileList | null) => {
    const added: VisitFile[] = []
    void run('files', list, async (file) => {
      added.push({ name: file.name, file: await uploadDocument(file, 'amc'), sizeKb: Math.max(1, Math.round(file.size / 1024)) })
    }).then(() => added.length && onFiles([...files, ...added]))
  }

  return (
    <div className="space-y-3">
      <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }} />
      <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="label">Photos <span className="font-normal normal-case text-stone-400">· {photos.length}</span></p>
          <button type="button" disabled={busy !== null} onClick={() => photoRef.current?.click()} className="btn-secondary py-1 text-xs disabled:opacity-60">
            <Icon name="camera" className="h-3.5 w-3.5" /> Add photos
          </button>
        </div>
        {busy === 'photos' && <p className="mb-2 text-xs text-stone-500">Compressing and uploading…</p>}
        {photos.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-stone-200 px-3 py-5 text-center text-xs text-stone-400">
            Before-and-after shots of the work. The client sees these on their report link.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo, i) => (
              <figure key={photo.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                <div className="relative">
                  <button type="button" onClick={() => setViewing(i)} className="block w-full">
                    <StoredImg src={photo.src} alt={photo.caption ?? 'Visit photo'} className="h-20 w-full object-cover" />
                  </button>
                  <button
                    type="button" onClick={() => onPhotos(photos.filter((p) => p.id !== photo.id))}
                    className="absolute right-1 top-1 rounded-md bg-stone-900/60 p-1 text-white hover:bg-red-600" aria-label="Remove photo"
                  >
                    <Icon name="trash" className="h-3 w-3" />
                  </button>
                </div>
                <input
                  value={photo.caption ?? ''} placeholder="Caption"
                  onChange={(e) => onPhotos(photos.map((p) => (p.id === photo.id ? { ...p, caption: e.target.value || undefined } : p)))}
                  className="w-full border-0 px-1.5 py-1 text-[11px] text-stone-700 placeholder:text-stone-400 focus:ring-0"
                />
              </figure>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="label">Report documents <span className="font-normal normal-case text-stone-400">· {files.length}</span></p>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setLinking(!linking)} aria-expanded={linking} className="btn-secondary py-1 text-xs">
              <Icon name="link" className="h-3.5 w-3.5" /> Add link
            </button>
            <button type="button" disabled={busy !== null} onClick={() => fileRef.current?.click()} className="btn-secondary py-1 text-xs disabled:opacity-60">
              <Icon name="clip" className="h-3.5 w-3.5" /> Attach
            </button>
          </div>
        </div>
        {linking && (
          <div className="mb-2">
            <LinkField
              onAdd={(link) => { onFiles([...files, { name: link.name, file: link.url }]); setLinking(false) }}
              onCancel={() => setLinking(false)}
            />
          </div>
        )}
        {busy === 'files' && <p className="mb-2 text-xs text-stone-500">Uploading…</p>}
        {files.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-lg bg-stone-50 px-2 py-1 text-xs text-stone-600 ring-1 ring-inset ring-stone-200">
                <Icon name={isLink(f.file) ? 'link' : 'doc'} className="h-3.5 w-3.5 text-stone-400" />
                <FileLink file={f.file} name={f.name} className="max-w-[200px] truncate" />
                <button type="button" onClick={() => onFiles(files.filter((_, j) => j !== i))} className="text-stone-400 hover:text-red-600" aria-label={`Remove ${f.name}`}>
                  <Icon name="x" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-stone-400">A service sheet or signed report, if there is one: the file (PDF, image…) or a link to it.</p>
        )}
      </div>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      {viewing !== null && (
        <Lightbox
          photos={photos.map((p) => ({ src: p.src, title: p.caption || 'Visit photo' }))}
          index={viewing} onIndex={setViewing} onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}

/**
 * Marks a visit done, with its report. A visit booked in advance is completed
 * in place; a date straight off the repeat schedule is recorded as a new visit
 * tied to it. On a visit already done it edits the report.
 */
export function VisitDoneModal({ occurrence: o, onClose }: { occurrence: AmcOccurrence; onClose: () => void }) {
  const db = useDb()
  const editing = Boolean(o.visit?.done)
  const [date, setDate] = useState(o.date > today() ? today() : o.date)
  const [teamIds, setTeamIds] = useState<ID[]>(o.visit?.teamIds ?? o.record.teamIds)
  const [notes, setNotes] = useState(o.visit?.notes ?? '')
  const [issues, setIssues] = useState<string[]>(o.visit?.issues.length ? o.visit.issues : [''])
  const [photos, setPhotos] = useState<VisitPhoto[]>(o.visit?.photos ?? [])
  const [files, setFiles] = useState<VisitFile[]>(o.visit?.files ?? [])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    if (uploading) return setError('Wait for the uploads to finish.')
    if (!notes.trim()) return setError('Note the work done on the visit.')
    if (teamIds.length === 0) return setError('Tick who went.')
    const report = { notes: notes.trim(), issues, photos, files }
    if (o.visit) api.amc.completeVisit(o.record.id, o.visit.id, report)
    else api.amc.recordVisit(o.record.id, { date, plannedFor: o.plannedFor, teamIds, ...report })
    onClose()
  }

  return (
    <Modal
      title={`${editing ? 'Visit report' : 'Visit'} — ${db.projects.find((p) => p.id === o.record.projectId)?.name ?? ''}`}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} disabled={uploading} className="btn-primary disabled:opacity-60">{editing ? 'Save report' : 'Mark done'}</button>
      </>}
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
          {o.record.type} · {editing ? `visited ${formatDateLong(o.date)}` : `planned for ${formatDateLong(o.plannedFor ?? o.date)}`}
        </p>
        {!o.visit && (
          <Field label="Visited on">
            <input type="date" className="input" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}
        {!o.visit && (
          <div>
            <p className="label mb-2">Team</p>
            <AmcTeamPicker value={teamIds} onChange={setTeamIds} />
          </div>
        )}
        <Field label="Work done" required>
          <textarea rows={3} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Lawn mowing, pruning, irrigation check…" />
        </Field>
        <Field label="Issues found">
          <RepeaterList values={issues} onChange={setIssues} addLabel="Add issue" placeholder="Leave blank if none" />
        </Field>
        <VisitAttachments photos={photos} files={files} onPhotos={setPhotos} onFiles={setFiles} onBusy={setUploading} />
        <FormError message={error} />
      </div>
    </Modal>
  )
}

/** Moves a scheduled visit to another day — the repeat schedule carries on unchanged. */
export function MoveVisitModal({ occurrence: o, onClose }: { occurrence: AmcOccurrence; onClose: () => void }) {
  const [date, setDate] = useState(o.date < today() ? today() : o.date)
  const [teamIds, setTeamIds] = useState<ID[]>(o.visit?.teamIds ?? o.record.teamIds)
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    if (!date) return setError('Pick the new date.')
    if (teamIds.length === 0) return setError('Assign at least one person.')
    if (o.visit) api.amc.moveVisit(o.record.id, o.visit.id, date, teamIds)
    else api.amc.scheduleVisit(o.record.id, date, teamIds, o.plannedFor)
    onClose()
  }

  return (
    <Modal
      title="Move this visit"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">Move visit</button>
      </>}
    >
      <div className="space-y-4">
        <p className="text-sm text-stone-600">
          Planned for <strong>{formatDate(o.plannedFor ?? o.date)}</strong>. Moving it books the visit on the new day; later visits keep to the schedule.
        </p>
        <Field label="New date" required>
          <input type="date" className="input" value={date} min={today()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div>
          <p className="label mb-2">Team</p>
          <AmcTeamPicker value={teamIds} onChange={setTeamIds} />
        </div>
        <FormError message={error} />
      </div>
    </Modal>
  )
}
