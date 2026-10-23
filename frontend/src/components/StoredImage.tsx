import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import { cachedUrl, isStoredFile, signedUrl } from '../data/files'

/**
 * The URL to show for a photo field: a stored file is signed on demand, and a
 * data URL (older records, the demo, a photo taken offline) is used as it is.
 */
export function useFileUrl(ref?: string): string | undefined {
  const stored = isStoredFile(ref)
  const hit = stored ? cachedUrl(ref) : undefined
  const [signed, setSigned] = useState<{ ref: string; url: string } | null>(null)

  useEffect(() => {
    if (!stored || hit) return
    let live = true
    void signedUrl(ref).then((url) => {
      if (live && url) setSigned({ ref, url })
    })
    return () => {
      live = false
    }
  }, [ref, stored, hit])

  if (!stored) return ref
  return hit ?? (signed?.ref === ref ? signed.url : undefined)
}

/** An `<img>` for a photo field. Shows a soft placeholder while a stored file is signed. */
export function StoredImg({ src, alt = '', className = '', ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src?: string }) {
  const url = useFileUrl(src)
  if (!url) return <span aria-hidden="true" className={`block animate-pulse bg-stone-200 ${className}`} />
  return <img src={url} alt={alt} className={className} {...rest} />
}
