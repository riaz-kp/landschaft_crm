import type { PhotoSession } from '../domain/types'

/** Small deterministic hash so a generated picture is the same on every load. */
function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

const SKY: Record<PhotoSession, [string, string, string]> = {
  // top, horizon, sun
  Morning: ['#9fd3f5', '#fdf2c4', '#fde68a'],
  Evening: ['#4c3b7a', '#f59e6b', '#fb923c'],
}

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * A stand-in site photograph, drawn as SVG. Real photos come from the foreman's
 * camera; these only exist so the seeded gallery has something to show. Each
 * is clearly labelled with the site, session and time.
 */
export function placeholderSitePhoto(key: string, label: string, session: PhotoSession, time: string): string {
  const h = hash(key)
  const [top, horizon, sun] = SKY[session]
  const sunX = session === 'Morning' ? 70 + (h % 80) : 330 + (h % 90)
  const sunY = session === 'Morning' ? 60 + (h % 30) : 120 + (h % 25)
  const ground = ['#6b8f4e', '#5f7f45', '#7a9a55'][h % 3]
  const soil = ['#8b6b4a', '#9a7752', '#7d5f42'][(h >>> 3) % 3]

  // Pavers, planting and a few shrubs — enough variety that days look different.
  const pavers = Array.from({ length: 5 + (h % 4) }, (_, i) => {
    const x = 20 + i * 62 + ((h >>> (i + 2)) % 12)
    return `<rect x="${x}" y="${238 + (i % 2) * 6}" width="52" height="18" rx="2" fill="#d6d3cc" stroke="#a8a29e"/>`
  }).join('')
  const plants = Array.from({ length: 6 + ((h >>> 5) % 6) }, (_, i) => {
    const x = 30 + ((h >>> i) % 420)
    const y = 200 + ((h >>> (i + 4)) % 30)
    const r = 10 + ((h >>> (i + 1)) % 14)
    const shade = ['#2f6b3d', '#3d8659', '#25553a', '#4f9a63'][(h >>> i) % 4]
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${shade}"/>`
  }).join('')
  const palms = Array.from({ length: 1 + (h % 3) }, (_, i) => {
    const x = 60 + i * 150 + ((h >>> (i + 7)) % 60)
    return `<rect x="${x}" y="120" width="6" height="90" fill="#7c5a3a"/>`
      + `<path d="M${x + 3} 122 q-40 -10 -55 15 M${x + 3} 122 q40 -12 55 12 M${x + 3} 122 q-20 -30 -40 -30 M${x + 3} 122 q22 -28 42 -26" stroke="#2f6b3d" stroke-width="7" fill="none" stroke-linecap="round"/>`
  }).join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" width="480" height="320">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${horizon}"/></linearGradient></defs>
<rect width="480" height="320" fill="url(#s)"/>
<circle cx="${sunX}" cy="${sunY}" r="26" fill="${sun}" opacity="0.9"/>
<path d="M0 190 Q120 165 240 182 T480 176 V320 H0Z" fill="${ground}"/>
<path d="M0 228 Q160 214 300 226 T480 222 V320 H0Z" fill="${soil}" opacity="0.55"/>
${palms}${plants}${pavers}
<rect y="282" width="480" height="38" fill="#000" opacity="0.45"/>
<text x="14" y="306" font-family="Inter,Arial,sans-serif" font-size="15" fill="#fff">${escapeXml(label)}</text>
<text x="466" y="306" font-family="Inter,Arial,sans-serif" font-size="13" fill="#fff" text-anchor="end">${session} · ${time}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * A stand-in plan of one area of a site, drawn as SVG: lawn, paving, planting
 * beds and trees, with a north arrow and the area's name. Real plans are the
 * design team's drawings; these only exist so the seeded BOQs have something
 * to show, and each is labelled as a sample.
 */
export function placeholderPlan(key: string, area: string): string {
  const h = hash(key)
  const pathY = 150 + (h % 90)
  const trees = Array.from({ length: 5 + (h % 4) }, (_, i) => {
    const x = 70 + ((h >>> i) % 640)
    const y = 60 + ((h >>> (i + 3)) % 90) + (i % 2) * (pathY + 40)
    const r = 16 + ((h >>> (i + 1)) % 16)
    return `<circle cx="${x}" cy="${Math.min(y, 440)}" r="${r}" fill="#8fbf8a" stroke="#4f7f4a" stroke-width="2"/>`
      + `<circle cx="${x}" cy="${Math.min(y, 440)}" r="3" fill="#4f7f4a"/>`
  }).join('')
  const stones = Array.from({ length: 11 }, (_, i) => {
    const x = 40 + i * 66
    return `<rect x="${x}" y="${pathY + 6}" width="54" height="26" rx="3" fill="#e4ddd0" stroke="#a89f8f"/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
<rect width="800" height="500" fill="#fbfaf6"/>
<g stroke="#e9e4da" stroke-width="1">${Array.from({ length: 21 }, (_, i) => `<line x1="${i * 40}" y1="0" x2="${i * 40}" y2="500"/>`).join('')}${Array.from({ length: 13 }, (_, i) => `<line x1="0" y1="${i * 40}" x2="800" y2="${i * 40}"/>`).join('')}</g>
<rect x="24" y="24" width="752" height="452" fill="none" stroke="#33463a" stroke-width="3"/>
<rect x="40" y="40" width="${300 + (h % 200)}" height="${pathY - 50}" fill="#cfe3c4" stroke="#6f9a63" stroke-width="2"/>
<rect x="${420 + (h % 120)}" y="${pathY + 52}" width="200" height="${370 - pathY}" fill="#d9d4ca" stroke="#8a8172" stroke-width="2"/>
<text x="${520 + (h % 120)}" y="${pathY + 52 + (370 - pathY) / 2}" font-family="Inter,Arial,sans-serif" font-size="14" fill="#5f574a" text-anchor="middle">BUILDING</text>
<rect x="24" y="${pathY}" width="752" height="38" fill="#f0ebe1"/>
${stones}${trees}
<g transform="translate(720 80)"><circle r="22" fill="#fff" stroke="#33463a" stroke-width="2"/><path d="M0 -16 L7 6 L0 2 L-7 6Z" fill="#33463a"/><text y="-28" font-family="Inter,Arial,sans-serif" font-size="12" font-weight="700" fill="#33463a" text-anchor="middle">N</text></g>
<g transform="translate(48 452)"><rect width="120" height="6" fill="#33463a"/><rect x="60" width="60" height="6" fill="#fff" stroke="#33463a"/><text y="-6" font-family="Inter,Arial,sans-serif" font-size="11" fill="#33463a">0      5      10 m</text></g>
<rect x="520" y="434" width="240" height="30" fill="#33463a"/>
<text x="640" y="454" font-family="Inter,Arial,sans-serif" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">${escapeXml(area.toUpperCase())} · SAMPLE PLAN</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
