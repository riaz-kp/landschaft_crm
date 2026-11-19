import type { LatLng } from '../domain/types'

/** Turn-by-turn directions from wherever the phone is — to the pin, or to a place name when there is none. */
export function directionsUrl(to: LatLng | string): string {
  const destination = typeof to === 'string' ? encodeURIComponent(to) : `${to.lat},${to.lng}`
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`
}

/** A Google Maps link to a pinned spot. */
export function placeLink(at: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${at.lat},${at.lng}`
}

/** A site that has not been pinned yet, looked up by its name. */
export function placeSearchUrl(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
}

/** What a pasted Google or Apple Maps link (or typed coordinates) points at: a spot, or only a place name to search for. */
export type ParsedMapLink = { coords: LatLng } | { query: string }

/**
 * Short share links that must be expanded before they can be read: "Share" in
 * the Google Maps app (maps.app.goo.gl/…) and in Apple Maps (maps.apple/p/…).
 */
export function isShortMapLink(text: string): boolean {
  return /^(https?:\/\/)?(maps\.app\.goo\.gl\/|goo\.gl\/maps\/|g\.co\/kgs\/|maps\.apple\/p\/|maps\.apple\.com\/p\/)/i.test(text.trim())
}

/** An Apple Maps link, full or short. Its pin is used like any other; the CRM's own links are always Google Maps. */
export function isAppleMapLink(text: string): boolean {
  return /^(https?:\/\/)?(maps\.apple\.com|maps\.apple)(\/|$|\?)/i.test(text.trim())
}

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)

/** "10.1234, 76.5678" (optionally "loc:" in front), as Google puts in q=, ll= and destination=. */
function decimalPair(text: string): LatLng | undefined {
  const m = text.match(/^\s*(?:loc:)?\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/)
  if (!m) return undefined
  const at = { lat: Number(m[1]), lng: Number(m[2]) }
  return valid(at.lat, at.lng) ? at : undefined
}

/** 10°09'47.5"N 76°38'28.7"E — how Google names a dropped pin. */
function dmsPair(text: string): LatLng | undefined {
  const part = String.raw`(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:\.\d+)?)["″]?\s*([NSEW])`
  const m = text.match(new RegExp(`${part}\\s*,?\\s*${part}`, 'i'))
  if (!m) return undefined
  const value = (d: string, mi: string, s: string, h: string) =>
    (Number(d) + Number(mi) / 60 + Number(s) / 3600) * (/[SW]/i.test(h) ? -1 : 1)
  const a = value(m[1], m[2], m[3], m[4])
  const b = value(m[5], m[6], m[7], m[8])
  const at = /[NS]/i.test(m[4]) ? { lat: a, lng: b } : { lat: b, lng: a }
  return valid(at.lat, at.lng) ? at : undefined
}

/**
 * Reads the spot out of a Google Maps link: the place's own pin (!3d…!4d…)
 * first, then the q / ll / destination parameters, then the map's centre
 * (@lat,lng). Apple Maps links work too (coordinate= / ll= / daddr=, as in
 * maps.apple.com/place?coordinate=10.93,75.92&name=…). Plain coordinates typed
 * or pasted work too. A link that names a place but carries no coordinates
 * gives its name (or Apple's address), to search for instead.
 */
export function parseMapLink(input: string): ParsedMapLink | undefined {
  const text = input.trim()
  if (!text) return undefined
  const plain = decimalPair(text) ?? dmsPair(decodeURIComponent(text.replace(/\+/g, ' ')))
  if (plain && !/^https?:/i.test(text)) return { coords: plain }

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return plain ? { coords: plain } : undefined
  }
  const full = decodeURIComponent(url.href)

  const pin = full.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (pin && valid(Number(pin[1]), Number(pin[2]))) return { coords: { lat: Number(pin[1]), lng: Number(pin[2]) } }

  for (const key of ['coordinate', 'q', 'query', 'll', 'sll', 'destination', 'daddr', 'center']) {
    const value = url.searchParams.get(key)
    const at = value ? decimalPair(value) ?? dmsPair(value) : undefined
    if (at) return { coords: at }
  }

  // /maps/place/10.1,76.2 or /maps/search/10.1,+76.2 or a dropped pin's name in the path.
  const segment = full.match(/\/maps\/(?:place|search|dir\/[^/]*)\/([^/@?]+)/)
  const named = segment ? segment[1].replace(/\+/g, ' ') : undefined
  const fromPath = named ? decimalPair(named) ?? dmsPair(named) : undefined
  if (fromPath) return { coords: fromPath }

  const centre = full.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (centre && valid(Number(centre[1]), Number(centre[2]))) return { coords: { lat: Number(centre[1]), lng: Number(centre[2]) } }

  const q = url.searchParams.get('q') ?? url.searchParams.get('query') ?? named
    ?? url.searchParams.get('address') ?? url.searchParams.get('name')
  if (q?.trim()) return { query: q.trim() }
  return undefined
}
