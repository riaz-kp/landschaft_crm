import { useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { ConfirmDialog } from '../../components/ui'
import { blankArea, blankAreaItem, formatRupees, itemAmount } from '../../domain/quotation'
import type { AreaItem, Quotation, QuoteArea } from '../../domain/types'
import { ItemPhoto, NumberInput, PlanImageField, move } from './editors'

interface Props {
  areas: QuoteArea[]
  onChange: (update: (areas: QuoteArea[]) => QuoteArea[]) => void
  priced: boolean
  plans: boolean
  disabled?: boolean
  /** Every document, for suggesting items and filling in what was used last time. */
  history: Quotation[]
}

/** The last specification, dimension, unit and rate used for each item on any document, newest document first. */
function lastUsed(history: Quotation[]) {
  type Last = Partial<Pick<AreaItem, 'specification' | 'dimension' | 'unit' | 'rate'>>
  const seen = new Map<string, Last>()
  const newest = [...history].sort((a, b) => b.date.localeCompare(a.date))
  for (const quote of newest) {
    for (const item of quote.areas.flatMap((a) => a.items)) {
      const key = item.item.trim().toLowerCase()
      if (!key) continue
      const known: Last = seen.get(key) ?? {}
      seen.set(key, {
        specification: known.specification ?? (item.specification?.trim() || undefined),
        dimension: known.dimension ?? item.dimension,
        unit: known.unit ?? item.unit,
        rate: known.rate ?? (quote.kind === 'Quotation' && item.rate ? item.rate : undefined),
      })
    }
  }
  return seen
}

/**
 * Hardscape, area by area: each area has its heading, its plan (when the
 * document carries plans) and the stones and items laid there.
 */
export function AreasEditor({ areas, onChange, priced, plans, disabled, history }: Props) {
  const [removing, setRemoving] = useState<QuoteArea | null>(null)
  const known = useMemo(() => lastUsed(history), [history])

  const setArea = (id: string, patch: Partial<QuoteArea>) => onChange((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  const setItems = (id: string, update: (items: AreaItem[]) => AreaItem[]) =>
    onChange((list) => list.map((a) => (a.id === id ? { ...a, items: update(a.items) } : a)))
  const setItem = (areaId: string, itemId: string, patch: Partial<AreaItem>) =>
    setItems(areaId, (items) => items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)))

  /** Typing an item used before fills in its specification, dimension, unit and rate from last time, where they are still empty. */
  const recall = (areaId: string, item: AreaItem) => {
    const last = known.get(item.item.trim().toLowerCase())
    if (!last) return
    const fill: Partial<AreaItem> = {}
    if (!item.specification?.trim() && last.specification) fill.specification = last.specification
    if (!item.dimension && last.dimension) fill.dimension = last.dimension
    if (last.unit && (!item.unit || item.unit === 'Sqft') && last.unit !== item.unit) fill.unit = last.unit
    if (priced && !item.rate && last.rate) fill.rate = last.rate
    if (Object.keys(fill).length) setItem(areaId, item.id, fill)
  }

  // One line per item only where there is room for the name beside the numbers; otherwise
  // the name goes on its own line with size, quantity, unit (and rate, amount) under it.
  const wide = priced
    ? '2xl:grid-cols-[28px_44px_minmax(0,1fr)_92px_88px_84px_104px_112px_32px]'
    : '2xl:grid-cols-[28px_44px_minmax(0,1fr)_110px_96px_96px_32px]'
  const numbers = priced ? 'grid-cols-3 md:grid-cols-5' : 'grid-cols-3'

  return (
    <div className="space-y-5">
      {areas.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 px-5 py-6 text-center">
          <p className="text-sm font-medium text-stone-600">No areas yet.</p>
          <p className="mt-1 text-sm text-stone-400">
            Add one for each part of the site — front yard, pathway, courtyard… — with {plans ? 'its plan and ' : ''}the stones and items laid there.
          </p>
        </div>
      )}

      {areas.map((area, index) => {
        const subtotal = area.items.reduce((s, item) => s + itemAmount(item), 0)
        return (
          <div key={area.id} className="rounded-2xl border border-stone-200 bg-stone-50/50">
            <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-4 py-3">
              <span className="rounded-md bg-[#33463a] px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white">Area {index + 1}</span>
              <input
                className="input order-last w-full font-semibold sm:order-none sm:w-auto sm:min-w-0 sm:flex-1" value={area.name} disabled={disabled}
                placeholder="Area heading, e.g. Front yard" aria-label={`Area ${index + 1} heading`}
                onChange={(e) => setArea(area.id, { name: e.target.value })}
              />
              {!disabled && (
                <div className="ml-auto flex items-center gap-0.5 sm:ml-0">
                  <button type="button" className="btn-icon" disabled={index === 0} onClick={() => onChange((list) => move(list, index, -1))} aria-label="Move area up" title="Move up">
                    <Icon name="arrowUp" className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-icon" disabled={index === areas.length - 1} onClick={() => onChange((list) => move(list, index, 1))} aria-label="Move area down" title="Move down">
                    <Icon name="arrowDown" className="h-4 w-4" />
                  </button>
                  <button
                    type="button" className="btn-icon hover:bg-red-50 hover:text-red-600" aria-label="Remove area" title="Remove area"
                    onClick={() => (area.items.length || area.planImage ? setRemoving(area) : onChange((list) => list.filter((a) => a.id !== area.id)))}
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4 p-4">
              {plans && (
                <div>
                  <p className="label mb-1.5">Plan image</p>
                  <PlanImageField value={area.planImage} areaName={area.name} disabled={disabled} onChange={(planImage) => setArea(area.id, { planImage })} />
                </div>
              )}

              <div>
                <p className="label mb-1.5">Stones &amp; items</p>
                <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  {/* Headings: one row on very wide screens; above the numbers line otherwise. */}
                  <div className={`hidden gap-2 bg-stone-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500 2xl:grid ${wide}`}>
                    <span>#</span><span>Photo</span><span>Stone / item</span><span>Dimension</span><span className="text-right">Qty</span><span>Unit</span>
                    {priced && <><span className="text-right">Rate (₹)</span><span className="text-right">Amount</span></>}
                    <span />
                  </div>
                  <div className="hidden grid-cols-[24px_44px_minmax(0,1fr)_32px] gap-2 bg-stone-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500 md:grid 2xl:hidden">
                    <span>#</span><span>Photo</span>
                    <span className={`col-span-2 grid gap-2 ${numbers}`}>
                      <span>Size</span><span className="text-right">Qty</span><span>Unit</span>
                      {priced && <><span className="text-right">Rate (₹)</span><span className="text-right">Amount</span></>}
                    </span>
                  </div>
                  {area.items.length === 0 && <p className="px-3 py-3 text-sm text-stone-400">No items in this area yet.</p>}
                  {area.items.map((item, i) => (
                    <div
                      key={item.id}
                      className={`grid grid-cols-[44px_minmax(0,1fr)_32px] items-center gap-2 border-t border-stone-100 p-3 first:border-t-0 md:grid-cols-[24px_44px_minmax(0,1fr)_32px] 2xl:py-2 ${wide}`}
                    >
                      <span className="hidden text-sm font-semibold tabular-nums text-stone-400 md:block">{i + 1}</span>
                      <ItemPhoto value={item.image} name={item.item} disabled={disabled} onChange={(image) => setItem(area.id, item.id, { image })} />
                      <div className="min-w-0 space-y-1.5">
                        <input
                          className="input font-medium" list="quote-items" value={item.item} disabled={disabled}
                          placeholder="Stone or item, e.g. Bangalore Stone" aria-label={`Area ${index + 1} item ${i + 1}`}
                          onChange={(e) => setItem(area.id, item.id, { item: e.target.value })}
                          onBlur={() => recall(area.id, item)}
                        />
                        <SpecField
                          value={item.specification} disabled={disabled} label={`Area ${index + 1} item ${i + 1} specification`}
                          onChange={(specification) => setItem(area.id, item.id, { specification })}
                        />
                      </div>
                      {!disabled ? (
                        <button
                          type="button" className="btn-icon justify-self-end hover:bg-red-50 hover:text-red-600 2xl:order-last"
                          onClick={() => setItems(area.id, (items) => items.filter((it) => it.id !== item.id))} aria-label="Remove item" title="Remove item"
                        >
                          <Icon name="x" className="h-4 w-4" />
                        </button>
                      ) : <span className="2xl:order-last" />}
                      <div className={`col-span-3 grid items-center gap-2 md:col-span-2 md:col-start-3 2xl:contents ${numbers}`}>
                        <input
                          className="input" value={item.dimension ?? ''} disabled={disabled} placeholder="Size, e.g. 1 x 4"
                          aria-label={`Area ${index + 1} item ${i + 1} dimension`}
                          onChange={(e) => setItem(area.id, item.id, { dimension: e.target.value })}
                        />
                        <NumberInput value={item.quantity} disabled={disabled} placeholder="Qty" label={`Area ${index + 1} item ${i + 1} quantity`} onChange={(quantity) => setItem(area.id, item.id, { quantity })} />
                        <input
                          className="input" list="quote-units" value={item.unit} disabled={disabled} placeholder="Unit"
                          aria-label={`Area ${index + 1} item ${i + 1} unit`}
                          onChange={(e) => setItem(area.id, item.id, { unit: e.target.value })}
                        />
                        {priced && (
                          <>
                            <NumberInput value={item.rate} disabled={disabled} placeholder="Rate" label={`Area ${index + 1} item ${i + 1} rate`} onChange={(rate) => setItem(area.id, item.id, { rate })} />
                            <span className="text-right text-sm font-semibold tabular-nums text-stone-800">{formatRupees(itemAmount(item))}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  {!disabled ? (
                    <button type="button" className="btn-ghost text-brand-700" onClick={() => setItems(area.id, (items) => [...items, blankAreaItem()])}>
                      <Icon name="plus" className="h-4 w-4" /> Add item
                    </button>
                  ) : <span />}
                  {priced && area.items.length > 0 && (
                    <p className="text-sm text-stone-500">{area.name.trim() || `Area ${index + 1}`} <strong className="ml-1 tabular-nums text-stone-900">{formatRupees(subtotal)}</strong></p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {!disabled && (
        <button type="button" className="btn-secondary" onClick={() => onChange((list) => [...list, { ...blankArea(), items: [blankAreaItem()] }])}>
          <Icon name="plus" className="h-4 w-4" /> Add area
        </button>
      )}

      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name.trim() || 'this area'}?`}
          message={<>Its {removing.items.length ? `${removing.items.length} item${removing.items.length === 1 ? '' : 's'}` : ''}{removing.items.length && removing.planImage ? ' and ' : ''}{removing.planImage ? 'plan image' : ''} will be taken off this document.</>}
          confirmLabel="Remove area"
          onClose={() => setRemoving(null)}
          onConfirm={() => onChange((list) => list.filter((a) => a.id !== removing.id))}
        />
      )}
    </div>
  )
}

/**
 * The material specification and laying method under an item, one point per
 * line. Hidden behind a small link until there is something to show, so short
 * items stay one line.
 */
function SpecField({ value, onChange, disabled, label }: { value?: string; onChange: (v: string | undefined) => void; disabled?: boolean; label: string }) {
  const [open, setOpen] = useState(false)
  const text = value ?? ''
  if (!text && !open) {
    if (disabled) return null
    return (
      <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setOpen(true)}>
        + Specification
      </button>
    )
  }
  return (
    <div>
      <textarea
        className="input min-h-[64px] resize-y text-xs leading-relaxed text-stone-700" value={text} disabled={disabled} aria-label={label}
        rows={Math.min(18, Math.max(3, text.split('\n').length + 1))} autoFocus={open && !text}
        placeholder={'Material specification\nColour - …\nSize - …\nLaying method\nBedding course - …'}
        onChange={(e) => onChange(e.target.value || undefined)}
        onBlur={() => { if (!text.trim()) { setOpen(false); onChange(undefined) } }}
      />
      {!disabled && <p className="mt-1 text-[11px] text-stone-400">One point per line. End a line with “:” to make it a heading.</p>}
    </div>
  )
}
