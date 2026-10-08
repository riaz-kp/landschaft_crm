import { useEffect } from 'react'
import { Icon } from './Icon'

export interface LightboxPhoto {
  src: string
  title: string
  sub?: string
}

/** Full-screen photo viewer with previous / next, arrow keys and Escape. */
export function Lightbox({
  photos, index, onIndex, onClose,
}: { photos: LightboxPhoto[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const photo = photos[index]
  const prev = () => onIndex((index - 1 + photos.length) % photos.length)
  const next = () => onIndex((index + 1) % photos.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!photo) return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-stone-950/95 backdrop-blur-sm" role="dialog" aria-modal="true">
      <header className="flex items-center justify-between gap-4 px-4 py-3 text-white sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{photo.title}</p>
          {photo.sub && <p className="truncate text-xs text-white/60">{photo.sub}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-white/60">{index + 1} / {photos.length}</span>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6 sm:px-16" onClick={onClose}>
        <img
          src={photo.src} alt={photo.title}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />
        {photos.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev() }}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:left-4"
              aria-label="Previous photo"
            >
              <Icon name="chevron" className="h-5 w-5 rotate-180" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next() }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:right-4"
              aria-label="Next photo"
            >
              <Icon name="chevron" className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
