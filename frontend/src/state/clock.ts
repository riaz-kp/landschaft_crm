import { useSyncExternalStore } from 'react'

/** How times are shown and entered on this device: 08:30 PM or 20:30. */
export type ClockFormat = '12h' | '24h'

const KEY = 'landschaft-clock-format'
const listeners = new Set<() => void>()

function read(): ClockFormat {
  try {
    return localStorage.getItem(KEY) === '24h' ? '24h' : '12h'
  } catch {
    return '12h'
  }
}

let current: ClockFormat = read()

/** The device's clock preference, for code outside React such as formatTime. */
export function getClock(): ClockFormat {
  return current
}

export function setClock(next: ClockFormat) {
  current = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // Private browsing: the choice lasts until the page is closed.
  }
  listeners.forEach((fn) => fn())
}

/** A per-device preference, so a foreman's phone can differ from the office. */
export function useClock(): [ClockFormat, (next: ClockFormat) => void] {
  const value = useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    getClock,
  )
  return [value, setClock]
}
