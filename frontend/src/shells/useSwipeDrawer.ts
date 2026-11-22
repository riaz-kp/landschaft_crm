import { useEffect, useRef, useState, type RefObject } from 'react'

/** Below this width the sidebar is a drawer (Tailwind's lg breakpoint). */
const PHONE = '(max-width: 1023.98px)'

/**
 * Whether a swipe starting here belongs to something else: a field, a map, an
 * open dialog, or a strip that scrolls sideways and still has room to scroll
 * the way the finger is going.
 */
function claimedElsewhere(target: EventTarget | null, opening: boolean): boolean {
  if (document.querySelector('[aria-modal="true"]')) return true
  let el = target instanceof Element ? target : null
  if (el?.closest('input, textarea, select, [contenteditable="true"], .leaflet-container, [data-no-swipe]')) return true
  while (el && el !== document.body) {
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 1) {
      const overflow = getComputedStyle(el).overflowX
      // A strip already at its left edge can't scroll right, so a swipe to the right opens the menu.
      if ((overflow === 'auto' || overflow === 'scroll') && !(opening && el.scrollLeft <= 0)) return true
    }
    el = el.parentElement
  }
  return false
}

/**
 * Opens the phone drawer with a swipe to the right and closes it with a swipe
 * to the left, the drawer following the finger. A quick flick is enough; a
 * slow drag decides on how far it got. Returns how far open the drawer is
 * (0–1) while a finger is on it, or null when it rests.
 */
export function useSwipeDrawer(open: boolean, setOpen: (open: boolean) => void, drawer: RefObject<HTMLElement | null>): number | null {
  const [drag, setDrag] = useState<number | null>(null)
  const openRef = useRef(open)
  openRef.current = open
  const setOpenRef = useRef(setOpen)
  setOpenRef.current = setOpen

  useEffect(() => {
    const phone = window.matchMedia(PHONE)
    let start: { x: number; y: number; open: boolean } | null = null
    let horizontal = false
    let progress = 0
    let lastX = 0
    let lastT = 0
    let velocity = 0

    const width = () => drawer.current?.offsetWidth || 288

    const onStart = (e: TouchEvent) => {
      start = null
      horizontal = false
      if (!phone.matches || e.touches.length !== 1) return
      const t = e.touches[0]
      const isOpen = openRef.current
      // With the drawer open, a swipe anywhere closes it; closed, the page gets first claim.
      if (!isOpen && claimedElsewhere(e.target, true)) return
      start = { x: t.clientX, y: t.clientY, open: isOpen }
      lastX = t.clientX
      lastT = e.timeStamp
      velocity = 0
    }

    const onMove = (e: TouchEvent) => {
      if (!start) return
      const t = e.touches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      if (!horizontal) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
        // Mostly sideways, and the right way for the drawer's state; anything else is a scroll.
        if (Math.abs(dx) > Math.abs(dy) * 1.4 && (start.open ? dx < 0 : dx > 0)) {
          horizontal = true
        } else {
          start = null
          return
        }
      }
      if (e.cancelable) e.preventDefault()
      const w = width()
      progress = Math.min(1, Math.max(0, (start.open ? w + dx : dx) / w))
      const dt = e.timeStamp - lastT
      if (dt > 0) velocity = (t.clientX - lastX) / dt
      lastX = t.clientX
      lastT = e.timeStamp
      setDrag(progress)
    }

    const onEnd = () => {
      if (start && horizontal) {
        const next = velocity > 0.35 ? true : velocity < -0.35 ? false : progress > 0.45
        setOpenRef.current(next)
        setDrag(null)
      }
      start = null
      horizontal = false
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [drawer])

  return drag
}
