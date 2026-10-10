import L from 'leaflet'

/** A map pin in any colour; a selected pin is drawn larger. */
export function pinIcon(colour: string, selected = false): L.DivIcon {
  const size = selected ? 40 : 30
  return L.divIcon({
    className: '',
    html: `<svg width="${size}" height="${size * 1.3}" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))">
      <path d="M17 43s15-14.2 15-26A15 15 0 0 0 2 17c0 11.8 15 26 15 26z" fill="${colour}" stroke="#fff" stroke-width="2.5"/>
      <circle cx="17" cy="17" r="6" fill="#fff"/></svg>`,
    iconSize: [size, size * 1.3],
    iconAnchor: [size / 2, size * 1.3 - 1],
  })
}

/** For text placed inside a map tooltip's HTML. */
export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/** Pin and dot colours on the consultations diary and map: green for consultations, blue for site visits. */
export const DIARY_COLOUR = { consultation: '#2d6b46', visit: '#0284c7' } as const
