import { BRAND } from './brand'

/** The company mark from logo.svg, as three stacked blocks. */
export function LogoMark({ className = 'h-8 w-8', color = '#C8B8A2' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="40 40 320 320" className={className} aria-hidden="true">
      <g transform="translate(-85,0)" fill={color}>
        <path d="M125 70 Q125 40 155 40 H245 Q275 40 275 70 V190 H125 Z" />
        <path d="M125 210 H275 V360 H155 Q125 360 125 330 V210 Z" />
        <path d="M295 210 H415 Q445 210 445 240 V330 Q445 360 415 360 H295 V210 Z" />
      </g>
    </svg>
  )
}

/** Mark plus the Landschaft wordmark, for dark backgrounds. */
export function LogoLockup({ sub = 'CRM' }: { sub?: string }) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] ring-1 ring-white/10">
        <LogoMark className="h-6 w-6" />
      </span>
      <span>
        <span className="block font-display text-[15px] font-bold leading-tight tracking-tight text-white">Landschaft</span>
        <span className="block text-[10px] font-semibold uppercase leading-tight tracking-[0.2em] text-[#C8B8A2]">{sub}</span>
      </span>
    </span>
  )
}

// The mark's three blocks, 320 × 320 units: 150-unit blocks with 20-unit gaps.
const MARK_BLOCKS = [
  'M0 30Q0 0 30 0H120Q150 0 150 30V150H0Z',
  'M0 170H150V320H30Q0 320 0 290V170Z',
  'M170 170H290Q320 170 320 200V290Q320 320 290 320H170V170Z',
] as const

// The LANDSCHAFT lettering, traced from the company's logo file: 955.5 × 98.8 units.
const WORDMARK_W = 955.5
const WORDMARK_H = 98.8
const WORDMARK =
  'M466.9 9.1l-3.2 7.3l-1.2 -0.3l-5.1 -2.7l-2.8 -1.1l-5.5 -1.7l-3.8 -1l-4.8 -0.6l-3.9 -0.2l-3.8 0.2l-4.8 0.6l-3.7 1.1l-4 1.6l-2.5 1.5l-2.1 1.8l-2.1 2.8l-1 2.1l-0.9 3.1l-0.2 3l0.1 2.3l0.3 1.3l0.8 2.4l0.8 1.6l1.1 1.3l1.6 1.6l1.8 1.4l2 1.2l2.7 1.2l6 2l19 5l7.1 2.4l2.2 1l5 2.9l2.2 1.8l2 2l1.4 1.9l1.2 2l1.2 2.7l0.7 3.5l0.3 4.7l-0.6 4.8l-0.8 3.1l-2.4 4.8l-1 1.4l-1.4 1.8l-2.5 2.3l-4.3 2.9l-3.3 1.5l-4 1.5l-3.8 0.9l-5.6 0.7l-4.7 0.3l-4.8 -0.1l-3 -0.2l-6.9 -1l-3.2 -0.7l-6.6 -2.2l-2.7 -1.2l-4.7 -2.6l-3.2 -2.3l-2.3 -2.1l3.9 -7.7l3.8 2.8l4.4 2.8l5.5 2.4l3.5 1.3l5.2 1.2l4.8 0.7l4.7 0.1l5.6 -0.1l4.7 -0.8l3.8 -1l3.3 -1.5l2.9 -1.8l2 -2l1.9 -2.9l1.2 -2.8l0.5 -2.6v-2.4l-0.2 -2.2l-0.5 -1.8l-0.8 -1.7l-0.9 -1.4l-1.5 -1.7l-1.7 -1.5l-1.9 -1.3l-1.6 -0.8l-4.4 -2l-2.4 -0.8l-9.4 -2.5l-9 -2.2l-8.4 -2.8l-4.8 -2.3l-2.6 -1.5l-3.1 -2.5l-2.6 -2.9l-1 -1.4l-0.7 -1.6l-1.4 -4.3l-0.7 -3.9l-0.1 -2.4l0.2 -2.3l0.9 -4.5l1.5 -4l1.5 -2.6l2.5 -3.1l2.9 -2.6l1.9 -1.4l4.1 -2.2l2.8 -1.2l3.1 -0.9l4.5 -1l4.8 -0.6l3.9 -0.2l4.7 0.1l4.9 0.7l4.6 0.9l4.4 1.1l2.4 0.8l5.6 2.4l3.1 1.8zM570.8 14.7l-6.6 5.8l-2.4 -2.3l-2.7 -2.1l-5 -2.9l-2.2 -1l-3 -1l-6.4 -1.5l-2.2 -0.3l-4 -0.1l-6.3 0.3l-5.2 1.1l-6 2l-5.8 3l-4.6 3.4l-2.4 2.3l-2.3 2.5l-3.3 4.7l-0.8 1.6l-1.8 3.8l-1.4 4.1l-1 5.3l-0.3 6.3l0.3 6.3l1.2 5.9l1.1 2.9l1.7 3.9l2.5 3.9l1.7 2.3l2.5 3l3.9 3.3l5.3 3.5l4.9 2.3l4.2 1.3l4 0.8l3.1 0.3l3.5 0.2h2.7l6.4 -0.6l3.9 -0.9l1.8 -0.5l1.8 -0.6l3.2 -1.6l2.1 -1.1l2.3 -1.6l2.3 -1.8l2.4 -2.1l0.5 -0.3l6.4 6.3l-2.7 2.7l-3.6 2.8l-4.9 3.1l-3.3 1.5l-4.1 1.5l-2.4 0.8l-3.2 0.6l-7.1 0.9l-4.8 0.1l-4.7 -0.2l-5.6 -0.8l-3.2 -0.7l-7.1 -2.4l-2.8 -1.2l-4.1 -2.3l-5.1 -3.6l-2.9 -2.7l-2.4 -2.5l-3.8 -4.9l-2.9 -5.1l-1.8 -3.8l-1.5 -4l-0.9 -3.9l-0.8 -4.7l-0.2 -2.3l-0.1 -4l0.2 -6.3l0.8 -4.7l1.1 -4.5l1.3 -3.5l2 -4.4l3.3 -5.4l2.7 -3.6l1.5 -1.7l2.5 -2.4l3.5 -2.9l2.3 -1.6l4 -2.4l6 -2.7l3.6 -1.2l5.8 -1.4l6.2 -0.8l3.9 -0.2l3.2 0.1l7 0.9l4.4 1l3.7 1.2l6.7 2.8l4.4 2.8l2.6 2.1l2.5 2.3l0.5 0.7zM0 0.9h10.2v88.2h54.4v8.9h-64.6zM120.5 0.9l44.4 97.1h-10.8l-11.5 -25.8h-54.3l-11.6 25.8h-10.6l44.3 -97.1zM181.1 0.9h8.4l62.5 78.8v-78.8h10.3v97.1h-8.6l-62.4 -78.7v78.7h-10.2zM293.9 97.7v-96.5l1.1 -0.2l2.1 -0.1h35.1l4.6 0.2l6.4 0.6l5.4 1l2.4 0.7l3 1l3.4 1.3l2.2 1.1l5 2.9l5 3.8l2.5 2.3l2.3 2.5l2.4 3.2l1.2 1.9l2.9 5.2l1.5 4l1 2.9l0.8 3.2l0.6 4.9l0.3 3v3.1l-0.1 4.8l-1 6.8l-0.7 2.5l-0.8 2.4l-1.5 4l-1.1 2.2l-2 3.5l-1.7 2.4l-2.1 2.7l-2.7 2.8l-4.7 4.1l-3.8 2.5l-2 1.2l-4.9 2.3l-4.8 1.6l-5.6 1.5l-5.5 0.8l-7.1 0.2h-35.1l-2.8 -0.1zM602 0.9v43.3h60.7v-43.3h10.3v97.1h-10.3v-44.8h-60.7v44.8h-10.1v-97.1zM743.4 0.9l44.4 97.1h-10.8l-11.5 -25.8h-54.3l-11.6 25.8h-10.6l44.3 -97.1zM870.6 0.9v8.9h-56.4v38h50.2v9h-50.2v41.2h-10.2v-97.1zM877.1 0.9h78.4v8.9h-34.2v88.2h-10.1v-88.2h-34.1zM305.3 89l2.9 0.1h24l4.5 -0.2l5.7 -0.7l4 -0.8l5.3 -1.8l3.2 -1.5l5 -3.1l3.8 -3.3l3.4 -3.8l3.1 -4.8l1.8 -3.8l1.8 -5.4l0.8 -4.6l0.3 -5.6l-0.2 -5.5l-0.8 -4.7l-1.1 -3.7l-1.3 -3.4l-0.8 -1.6l-2.7 -4.5l-3.6 -4.4l-3.4 -3l-4.8 -3.2l-4.7 -2.4l-2.3 -0.9l-4.4 -1.1l-4.7 -0.9l-5.4 -0.5l-3.3 -0.1h-24.7l-2.4 0.2l-0.2 78.8zM92.1 63.7h46.7l-23.4 -52.2zM715 63.7h46.7l-23.4 -52.1z'

/** The mark in the logo's three colours, `size` pixels square. */
export function BrandMark({ size, className }: { size: number; className?: string }) {
  const fills = [BRAND.dark, BRAND.sage, BRAND.sand]
  return (
    <svg viewBox="0 0 320 320" width={size} height={size} className={className} aria-hidden="true">
      {MARK_BLOCKS.map((d, i) => <path key={i} d={d} fill={fills[i]} />)}
    </svg>
  )
}

/** The LANDSCHAFT lettering alone, `height` pixels tall (the height of its capitals). */
export function BrandWordmark({ height, color = BRAND.dark, label, className }: { height: number; color?: string; label?: string; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${WORDMARK_W} ${WORDMARK_H}`} width={(height * WORDMARK_W) / WORDMARK_H} height={height} className={className}
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    >
      <path d={WORDMARK} fill={color} />
    </svg>
  )
}

/** The whole logo as in the company's file: the mark over the lettering, `width` pixels wide. */
export function BrandLogo({ width, label = 'Landschaft', className }: { width: number; label?: string; className?: string }) {
  // The lettering sits 104.7 units under the mark and starts 321.6 units left of it, as drawn in the file.
  const left = -321.63
  const height = 424.72 + WORDMARK_H
  return (
    <svg viewBox={`${left} 0 ${WORDMARK_W} ${height}`} width={width} height={(width * height) / WORDMARK_W} className={className} role="img" aria-label={label}>
      {MARK_BLOCKS.map((d, i) => <path key={i} d={d} fill={[BRAND.dark, BRAND.sage, BRAND.sand][i]} />)}
      <path d={WORDMARK} fill={BRAND.dark} transform={`translate(${left} 424.72)`} />
    </svg>
  )
}
