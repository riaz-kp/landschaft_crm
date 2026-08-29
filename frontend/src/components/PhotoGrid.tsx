import { useRef } from 'react'
import type { ReportPhoto } from '../domain/types'
import { Icon } from './Icon'

/**
 * Site photos. The prototype stores data URLs so an upload survives a reload;
 * production would put these in object storage and keep only the key.
 */
export function PhotoGrid({
  photos, onChange, disabled,
}: { photos: ReportPhoto[]; onChange: (next: ReportPhoto[]) => void; disabled?: boolean }) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const addFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        onChange([
          ...photos,
          { id: `ph${Date.now()}${Math.random().toString(36).slice(2, 6)}`, src: String(reader.result) },
        ])
      }
      reader.readAsDataURL(file)
    })
  }

  const setCaption = (id: string, caption: string) =>
    onChange(photos.map((p) => (p.id === id ? { ...p, caption } : p)))

  const remove = (id: string) => onChange(photos.filter((p) => p.id !== id))

  return (
    <div>
      {!disabled && (
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            ref={cameraRef} type="file" accept="image/*" capture="environment" multiple
            className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
          />
          <input
            ref={galleryRef} type="file" accept="image/*" multiple
            className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
          />
          <button type="button" onClick={() => cameraRef.current?.click()} className="btn-secondary">
            <Icon name="camera" className="h-4 w-4" /> Camera
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()} className="btn-secondary">
            <Icon name="plus" className="h-4 w-4" /> Gallery
          </button>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-stone-300 px-4 py-8 text-center">
          <p className="text-sm text-stone-400">No photos attached</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <figure key={photo.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
              <div className="relative">
                <img src={photo.src} alt={photo.caption ?? 'Site photo'} className="h-28 w-full object-cover" />
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
          ))}
        </div>
      )}
    </div>
  )
}
