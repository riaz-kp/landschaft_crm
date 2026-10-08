import { useRef, useState } from 'react'
import { PHOTO_SESSIONS, type PhotoSession, type ReportPhoto } from '../domain/types'
import { currentTime, formatTime } from '../domain/format'
import { Icon } from './Icon'
import { resizeImage } from './imageResize'
import { Lightbox } from './Lightbox'

const SESSION_ICON: Record<PhotoSession, string> = { Morning: 'sun', Evening: 'moon' }

/**
 * Site photos. Foremen photograph the site twice a day — in the morning
 * before work starts and in the evening when it ends — so each photo carries
 * its session. With `session` set the grid shows and adds only that session;
 * without it, it shows everything grouped by session (read-only views).
 *
 * The prototype stores shrunk data URLs so an upload survives a reload;
 * production would put these in object storage and keep only the key.
 */
export function PhotoGrid({
  photos, onChange, disabled, session,
}: { photos: ReportPhoto[]; onChange: (next: ReportPhoto[]) => void; disabled?: boolean; session?: PhotoSession }) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const shown = session ? photos.filter((p) => p.session === session) : photos

  const addFiles = async (files: FileList | null) => {
    if (!files || !session) return
    setError(null)
    const added: ReportPhoto[] = []
    for (const file of Array.from(files)) {
      try {
        added.push({
          id: `ph${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
          src: await resizeImage(file, 1280),
          session,
          takenAt: currentTime(),
        })
      } catch {
        setError(`${file.name} could not be read as an image.`)
      }
    }
    if (added.length) onChange([...photos, ...added])
  }

  const setCaption = (id: string, caption: string) =>
    onChange(photos.map((p) => (p.id === id ? { ...p, caption } : p)))

  const remove = (id: string) => onChange(photos.filter((p) => p.id !== id))

  const tile = (photo: ReportPhoto) => (
    <figure key={photo.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="relative">
        <button type="button" onClick={() => setViewing(shown.indexOf(photo))} className="block w-full">
          <img src={photo.src} alt={photo.caption ?? 'Site photo'} className="h-32 w-full object-cover transition hover:opacity-90" />
        </button>
        <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-md bg-stone-900/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          <Icon name={SESSION_ICON[photo.session]} className="h-3 w-3" />
          {photo.takenAt ? formatTime(photo.takenAt) : photo.session}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={() => remove(photo.id)}
            className="absolute right-1.5 top-1.5 rounded-md bg-stone-900/60 p-1.5 text-white hover:bg-red-600"
            aria-label="Remove photo"
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {disabled ? (
        photo.caption && <figcaption className="px-2 py-1.5 text-xs text-stone-600">{photo.caption}</figcaption>
      ) : (
        <input
          type="text" value={photo.caption ?? ''} placeholder="Caption (optional)"
          onChange={(e) => setCaption(photo.id, e.target.value)}
          className="w-full border-0 px-2 py-1.5 text-xs text-stone-700 placeholder:text-stone-400 focus:ring-0"
        />
      )}
    </figure>
  )

  return (
    <div>
      {!disabled && session && (
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            ref={cameraRef} type="file" accept="image/*" capture="environment" multiple
            className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
          />
          <input
            ref={galleryRef} type="file" accept="image/*" multiple
            className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
          />
          <button type="button" onClick={() => cameraRef.current?.click()} className="btn-primary">
            <Icon name="camera" className="h-4 w-4" /> Take {session.toLowerCase()} photo
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()} className="btn-secondary">
            <Icon name="image" className="h-4 w-4" /> From gallery
          </button>
        </div>
      )}
      {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}

      {shown.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-stone-300 px-4 py-7 text-center">
          <p className="text-sm text-stone-400">{session ? `No ${session.toLowerCase()} photos yet` : 'No photos attached'}</p>
        </div>
      ) : session ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{shown.map(tile)}</div>
      ) : (
        <div className="space-y-4">
          {PHOTO_SESSIONS.map((s) => {
            const group = shown.filter((p) => p.session === s)
            return (
              <div key={s}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500">
                  <Icon name={SESSION_ICON[s]} className="h-3.5 w-3.5" /> {s} <span className="font-normal normal-case text-stone-400">· {group.length}</span>
                </p>
                {group.length === 0
                  ? <p className="rounded-xl border border-dashed border-stone-200 px-3 py-4 text-center text-xs text-stone-400">No {s.toLowerCase()} photo</p>
                  : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{group.map(tile)}</div>}
              </div>
            )
          })}
        </div>
      )}

      {viewing !== null && (
        <Lightbox
          photos={shown.map((p) => ({ src: p.src, title: p.caption || `${p.session} photo`, sub: p.takenAt ? `${p.session} · ${formatTime(p.takenAt)}` : p.session }))}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}
