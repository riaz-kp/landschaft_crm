import type { LatLng } from '../domain/types'

/** Turn-by-turn directions from wherever the phone is — to the pin, or to a place name when there is none. */
export function directionsUrl(to: LatLng | string): string {
  const destination = typeof to === 'string' ? encodeURIComponent(to) : `${to.lat},${to.lng}`
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`
}

/** A site that has not been pinned yet, looked up by its name. */
export function placeSearchUrl(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
}
