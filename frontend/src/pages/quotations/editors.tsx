import { useRef, useState, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { StoredImg } from '../../components/StoredImage'
import { compressImage } from '../../components/imageResize'
import { storePhoto } from '../../data/files'
import { formatRupees, serviceAmount, specLines } from '../../domain/quotation'
import type { PaymentStage, ServiceLine, TitledText } from '../../domain/types'

// ---------------------------------------------------------------- small pieces

/**
 * An item's specification, line by line as the BOQ spreadsheet sets it out:
 * "Material specification" and "Laying method" as small headings, each point
 * under them on its own line.
 */
export function SpecText({ spec, className = '', headingClassName = '' }: { spec?: string; className?: string; headingClassName?: string }) {
  const lines = specLines(spec)
  if (!lines.length) return null
  return (
    <div className={className}>
      {lines.map((line, i) => (line.heading
        ? <p key={i} className={`${i > 0 ? 'mt-1.5' : ''} font-semibold uppercase tracking-[0.12em] ${headingClassName}`}>{line.text}</p>
        : <p key={i}>{line.text}</p>))}
    </div>
  )
}

/** Moves one entry of a list up (-1) or down (+1). */
export function move<T>(list: T[], index: number, by: -1 | 1): T[] {
  const to = index + by
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

/** A number box that shows blank for zero, so a new line reads as empty rather than "0". */
export function NumberInput({
  value, onChange, disabled, label, className = '', placeholder = '0',
}: { value: number | undefined; onChange: (v: number) => void; disabled?: boolean; label: string; className?: string; placeholder?: string }) {
  return (
    <input
      type="number" inputMode="decimal" min={0} step="any"
      className={`input text-right tabular-nums ${className}`}
      value={value ? value : ''}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
    />
  )
}

export function Switch({ checked, onChange, label, disabled, compact }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean
  /** No "In document / Left out" text beside it, for a narrow column. */
  compact?: boolean
}) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2 text-xs font-semibold text-stone-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-stone-300'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {!compact && <span className="hidden sm:inline">{checked ? 'In document' : 'Left out'}</span>}
    </button>
  )
}

/** One part of the document in the editor, with a switch to leave it out of the printed document. */
export function SectionCard({
  id, title, description, included = true, onInclude, readOnly, actions, children,
}: {
  id: string; title: ReactNode; description?: ReactNode; included?: boolean; onInclude?: (v: boolean) => void
  readOnly?: boolean; actions?: ReactNode; children: ReactNode
}) {
  return (
    <section id={id} className="card min-w-0 scroll-mt-24 overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-semibold text-stone-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          {included && actions}
          {onInclude && <Switch checked={included} onChange={onInclude} label={`Include ${typeof title === 'string' ? title : 'section'}`} disabled={readOnly} />}
        </div>
      </header>
      {included ? children : <p className="px-5 py-4 text-sm text-stone-400">Left out of this document.</p>}
    </section>
  )
}

function RowButtons({ index, count, onMove, onRemove, disabled, noun }: {
  index: number; count: number; onMove: (by: -1 | 1) => void; onRemove: () => void; disabled?: boolean; noun: string
}) {
  if (disabled) return null
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button type="button" className="btn-icon h-7 w-7" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move ${noun} up`} title="Move up">
        <Icon name="arrowUp" className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="btn-icon h-7 w-7" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move ${noun} down`} title="Move down">
        <Icon name="arrowDown" className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="btn-icon h-7 w-7 hover:bg-red-50 hover:text-red-600" onClick={onRemove} aria-label={`Remove ${noun}`} title="Remove">
        <Icon name="trash" className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- images

/**
 * Shrinks a picture on the device and stores it. Plans are drawings, so they
 * keep more detail than a site photo; item photos are thumbnails.
 */
export async function storeQuoteImage(file: File, kind: 'plan' | 'item'): Promise<string> {
  const { dataUrl } = kind === 'plan' ? await compressImage(file, 2200, 900) : await compressImage(file, 480, 80)
  return storePhoto(dataUrl, 'quotations')
}

/** The plan of an area: drop in a picture, replace it, or take it off. */
export function PlanImageField({ value, onChange, disabled, areaName }: {
  value?: string; onChange: (v: string | undefined) => void; disabled?: boolean; areaName: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const take = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onChange(await storeQuoteImage(file, 'plan'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The picture could not be added.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void take(e.target.files?.[0])} />
      {value ? (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
          <StoredImg src={value} alt={`Plan of ${areaName || 'the area'}`} className="mx-auto max-h-80 w-full object-contain" />
          {!disabled && (
            <div className="flex justify-end gap-2 border-t border-stone-200 bg-white px-3 py-2">
              <button type="button" className="btn-ghost py-1 text-xs" onClick={() => input.current?.click()} disabled={busy}>
                <Icon name="upload" className="h-3.5 w-3.5" /> {busy ? 'Adding…' : 'Replace plan'}
              </button>
              <button type="button" className="btn-ghost py-1 text-xs text-red-600 hover:bg-red-50" onClick={() => onChange(undefined)}>
                <Icon name="trash" className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          )}
        </div>
      ) : disabled ? (
        <p className="rounded-xl border border-dashed border-stone-200 px-4 py-3 text-sm text-stone-400">No plan image.</p>
      ) : (
        <button
          type="button" onClick={() => input.current?.click()} disabled={busy}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            void take(e.dataTransfer.files?.[0])
          }}
          className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/60 px-4 py-6 text-center transition hover:border-brand-400 hover:bg-brand-50/40"
        >
          <Icon name="image" className="h-6 w-6 text-stone-400" />
          <span className="text-sm font-semibold text-stone-700">{busy ? 'Adding the plan…' : 'Add the plan of this area'}</span>
          <span className="text-xs text-stone-400">A picture of the drawing — JPG or PNG. Drop it here or click to choose.</span>
        </button>
      )}
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}

/** A small photo of a stone or item: click to add or change it. */
export function ItemPhoto({ value, onChange, disabled, name }: { value?: string; onChange: (v: string | undefined) => void; disabled?: boolean; name: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const take = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      onChange(await storeQuoteImage(file, 'item'))
    } catch {
      // A picture that will not load is simply not added.
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  const box = 'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50'
  if (disabled) {
    return value ? <StoredImg src={value} alt={name} className={`${box} object-cover`} /> : <span className={box}><Icon name="image" className="h-4 w-4 text-stone-300" /></span>
  }
  return (
    <span className="relative">
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void take(e.target.files?.[0])} />
      <button type="button" onClick={() => input.current?.click()} className={`${box} hover:border-brand-400`} title={value ? 'Change photo' : 'Add a photo'} aria-label={`Photo of ${name || 'item'}`}>
        {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-brand-600" />
          : value ? <StoredImg src={value} alt={name} className="h-full w-full object-cover" />
            : <Icon name="camera" className="h-4 w-4 text-stone-400" />}
      </button>
      {value && !busy && (
        <button
          type="button" onClick={() => onChange(undefined)}
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-stone-700 text-white"
          aria-label="Remove photo" title="Remove photo"
        >
          <Icon name="x" className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  )
}

// ---------------------------------------------------------------- lists

/** Terms, or the steps of the work procedure: numbered paragraphs with a title. */
export function TitledListEditor({
  items, onChange, disabled, addLabel, titlePlaceholder, textPlaceholder, noun,
}: {
  items: TitledText[]; onChange: (items: TitledText[]) => void; disabled?: boolean
  addLabel: string; titlePlaceholder: string; textPlaceholder: string; noun: string
}) {
  const set = (i: number, patch: Partial<TitledText>) => onChange(items.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  return (
    <div>
      {items.length === 0 && <p className="px-1 pb-2 text-sm text-stone-400">None yet.</p>}
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 rounded-xl border border-stone-200 bg-white p-3">
            <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#f1ece4] text-xs font-bold tabular-nums text-stone-700">{i + 1}</span>
            <div className="min-w-0 flex-1 space-y-2">
              <input
                className="input font-semibold" value={item.title} placeholder={titlePlaceholder} disabled={disabled}
                onChange={(e) => set(i, { title: e.target.value })} aria-label={`${noun} ${i + 1} title`}
              />
              <textarea
                className="input min-h-[64px] resize-y" rows={2} value={item.text} placeholder={textPlaceholder} disabled={disabled}
                onChange={(e) => set(i, { text: e.target.value })} aria-label={`${noun} ${i + 1} text`}
              />
            </div>
            <RowButtons
              index={i} count={items.length} disabled={disabled} noun={noun}
              onMove={(by) => onChange(move(items, i, by))} onRemove={() => onChange(items.filter((_, j) => j !== i))}
            />
          </li>
        ))}
      </ol>
      {!disabled && (
        <button type="button" className="btn-ghost mt-2 text-brand-700" onClick={() => onChange([...items, { title: '', text: '' }])}>
          <Icon name="plus" className="h-4 w-4" /> {addLabel}
        </button>
      )}
    </div>
  )
}

/** Project management, planting labour, soil preparation, logistics: lines with a scope description. */
export function ServicesEditor({
  lines, onChange, disabled, priced, blank,
}: { lines: ServiceLine[]; onChange: (lines: ServiceLine[]) => void; disabled?: boolean; priced: boolean; blank: () => ServiceLine }) {
  const set = (i: number, patch: Partial<ServiceLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const total = lines.reduce((s, l) => s + serviceAmount(l), 0)
  return (
    <div>
      {lines.length === 0 && <p className="pb-2 text-sm text-stone-400">No lines yet.</p>}
      <ol className="space-y-3">
        {lines.map((line, i) => (
          <li key={line.id} className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="flex gap-3">
              <span className="mt-2 w-5 shrink-0 text-right text-sm font-semibold tabular-nums text-stone-400">{i + 1}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  className="input font-semibold" value={line.title} placeholder="e.g. Planting Labour, Management & Supervision" disabled={disabled}
                  onChange={(e) => set(i, { title: e.target.value })} aria-label={`Line ${i + 1} title`}
                />
                <textarea
                  className="input min-h-[56px] resize-y text-[13px]" rows={2} value={line.description ?? ''} disabled={disabled}
                  placeholder="What it includes, and what it does not"
                  onChange={(e) => set(i, { description: e.target.value })} aria-label={`Line ${i + 1} scope`}
                />
                <div className={`grid gap-2 ${priced ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:max-w-xs'}`}>
                  <label className="block">
                    <span className="label">Qty</span>
                    <NumberInput value={line.quantity} onChange={(quantity) => set(i, { quantity })} disabled={disabled} label={`Line ${i + 1} quantity`} className="mt-1" />
                  </label>
                  <label className="block">
                    <span className="label">Unit</span>
                    <input className="input mt-1" list="quote-units" value={line.unit} disabled={disabled} onChange={(e) => set(i, { unit: e.target.value })} aria-label={`Line ${i + 1} unit`} />
                  </label>
                  {priced && (
                    <>
                      <label className="block">
                        <span className="label">Rate (₹)</span>
                        <NumberInput value={line.rate} onChange={(rate) => set(i, { rate })} disabled={disabled} label={`Line ${i + 1} rate`} className="mt-1" />
                      </label>
                      <div>
                        <span className="label">Amount</span>
                        <p className="mt-1 py-2 text-right text-sm font-semibold tabular-nums text-stone-900">{formatRupees(serviceAmount(line))}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <RowButtons
                index={i} count={lines.length} disabled={disabled} noun="line"
                onMove={(by) => onChange(move(lines, i, by))} onRemove={() => onChange(lines.filter((_, j) => j !== i))}
              />
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {!disabled ? (
          <button type="button" className="btn-ghost text-brand-700" onClick={() => onChange([...lines, blank()])}>
            <Icon name="plus" className="h-4 w-4" /> Add line
          </button>
        ) : <span />}
        {priced && lines.length > 0 && (
          <p className="text-sm text-stone-500">Subtotal <strong className="ml-1 tabular-nums text-stone-900">{formatRupees(total)}</strong></p>
        )}
      </div>
    </div>
  )
}

/** Payment stages as shares of the grand total; they must add up to 100%. */
export function PaymentStagesEditor({
  stages, onChange, disabled, total, onReset,
}: { stages: PaymentStage[]; onChange: (stages: PaymentStage[]) => void; disabled?: boolean; total?: number; onReset?: () => void }) {
  const set = (i: number, patch: Partial<PaymentStage>) => onChange(stages.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const sum = stages.reduce((s, stage) => s + stage.percent, 0)
  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-stone-200">
        {stages.map((stage, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 border-t border-stone-100 bg-white px-3 py-2 first:border-t-0 sm:flex-nowrap">
            <span className="w-5 shrink-0 text-right text-sm font-semibold tabular-nums text-stone-400">{i + 1}</span>
            <input
              className="input min-w-0 flex-1" value={stage.label} placeholder="e.g. Advance on confirmation / work order" disabled={disabled}
              onChange={(e) => set(i, { label: e.target.value })} aria-label={`Stage ${i + 1}`}
            />
            <div className="flex items-center gap-1">
              <NumberInput value={stage.percent} onChange={(percent) => set(i, { percent: Math.min(100, percent) })} disabled={disabled} label={`Stage ${i + 1} percent`} className="w-20" />
              <span className="text-sm text-stone-500">%</span>
            </div>
            {total !== undefined && <span className="w-32 text-right text-sm font-semibold tabular-nums text-stone-800">{formatRupees((total * stage.percent) / 100)}</span>}
            <RowButtons
              index={i} count={stages.length} disabled={disabled} noun="stage"
              onMove={(by) => onChange(move(stages, i, by))} onRemove={() => onChange(stages.filter((_, j) => j !== i))}
            />
          </div>
        ))}
        {stages.length === 0 && <p className="px-3 py-3 text-sm text-stone-400">No stages.</p>}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {!disabled && (
            <button type="button" className="btn-ghost text-brand-700" onClick={() => onChange([...stages, { label: '', percent: Math.max(0, 100 - sum) }])}>
              <Icon name="plus" className="h-4 w-4" /> Add stage
            </button>
          )}
          {!disabled && onReset && <button type="button" className="btn-ghost text-stone-500" onClick={onReset}>Use company default</button>}
        </div>
        <span className={`text-sm font-semibold tabular-nums ${sum === 100 ? 'text-brand-700' : 'text-red-600'}`}>
          {sum}% {sum === 100 ? '' : '— must total 100%'}
        </span>
      </div>
    </div>
  )
}
