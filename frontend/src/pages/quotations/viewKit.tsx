import type { ReactNode } from 'react'
import { BRAND } from '../../components/brand'
import { formatRupees } from '../../domain/quotation'
import type { Quotation } from '../../domain/types'

/** Pieces of the on-screen document view, shared by BOQs, quotations and scope proposals. */

export const CREAM = '#f6f3ec'

export function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <header className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ background: BRAND.dark }}>
        <h2 className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-white">
          <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: BRAND.sand }} />
          <span className="truncate">{title}</span>
        </h2>
        {note && <span className="shrink-0 text-xs" style={{ color: BRAND.sand }}>{note}</span>}
      </header>
      {children}
    </section>
  )
}

export function Num({ n }: { n: number }) {
  return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f1ece4] text-xs font-bold" style={{ color: BRAND.dark }}>{n}</span>
}

export function PaymentCard({ stages, total, title = 'Payment schedule', format = formatRupees }: { stages: Quotation['paymentStages']; total: number; title?: string; format?: (amount: number) => string }) {
  const sum = stages.reduce((s, x) => s + x.percent, 0) || 1
  const palette = [BRAND.dark, '#4c644d', BRAND.sage, '#a9ad95', BRAND.sand, '#e9e1d4']
  return (
    <Card title={title}>
      <div className="flex h-8 gap-1 px-4 pt-4 sm:px-5" style={{ boxSizing: 'content-box' }}>
        {stages.map((s, i) => (
          <div
            key={i} className="flex min-w-0 items-center justify-center rounded-md text-[10px] font-bold tabular-nums"
            style={{ flex: Math.max(s.percent, 4) / sum, background: palette[i % palette.length], color: i < 3 ? '#fff' : BRAND.dark }}
          >
            {s.percent >= 15 ? `${s.percent}%` : ''}
          </div>
        ))}
      </div>
      <ul className="mt-3 divide-y divide-stone-100 border-t border-stone-100">
        {stages.map((stage, i) => (
          <li key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: palette[i % palette.length] }} />
            <span className="min-w-0 flex-1 text-stone-800">{stage.label}</span>
            <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{stage.percent}%</span>
            <span className="w-28 shrink-0 text-right font-semibold tabular-nums">{format((total * stage.percent) / 100)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
