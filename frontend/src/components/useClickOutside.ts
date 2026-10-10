import { useEffect, type RefObject } from 'react'

/**
 * Calls `onOutside` when a press lands outside `ref`. Used by the header
 * menus instead of a full-screen overlay: the header's backdrop blur makes it
 * the containing block for fixed children, so an overlay inside it only ever
 * covered the header itself.
 */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(e.target as Node)) onOutside()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOutside() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [active, onOutside, ref])
}
