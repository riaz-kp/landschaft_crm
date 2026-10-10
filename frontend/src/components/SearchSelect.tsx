import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Avatar } from './ui'
import { Icon } from './Icon'

export interface SelectOption {
  value: string
  label: string
  /** Second line under the label. */
  sub?: string
  /** Heading the option is listed under. Groups keep the order they first appear in. */
  group?: string
  /** Extra text the search matches on, beyond the label and sub line. */
  keywords?: string
  /** Shows an avatar before the label; a string is used as the photo. */
  avatar?: boolean | string
  badge?: ReactNode
}

/** Phones get a panel pinned to the top of the screen, clear of the keyboard. */
const isPhone = () => window.innerWidth < 640

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

/** Every word typed must appear somewhere in the option. */
function matches(option: SelectOption, words: string[]) {
  if (!words.length) return true
  const text = `${option.label} ${option.sub ?? ''} ${option.keywords ?? ''}`.toLowerCase()
  return words.every((w) => text.includes(w))
}

type Placement = { top?: number; bottom?: number; left: number; width: number; listMax: number }

/**
 * A dropdown with a search box, used for anything picked from a long list —
 * projects, clients, people, skills. Options are sorted A–Z within their
 * group. The list opens in a portal, so a card or modal never clips it.
 */
export function SearchSelect({
  value, onChange, options, placeholder = 'Choose…', emptyOption, searchPlaceholder = 'Search…',
  sort = true, size = 'md', className = '', disabled, ariaLabel, title, onCreate, createLabel,
  footer, renderValue,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Shown in the closed control when nothing is chosen. */
  placeholder?: string
  /** Adds a first option, e.g. "All projects", that clears the value. */
  emptyOption?: string
  searchPlaceholder?: string
  sort?: boolean
  size?: 'sm' | 'md'
  className?: string
  disabled?: boolean
  ariaLabel?: string
  /** Heading of the panel on a phone. */
  title?: string
  /** Offers the typed text as a new option when nothing matches it exactly. */
  onCreate?: (text: string) => void
  createLabel?: (text: string) => string
  /** Extra row at the foot of the panel, e.g. "Add a new client". */
  footer?: (close: () => void, query: string) => ReactNode
  /** Custom content for the closed control when an option is chosen. */
  renderValue?: (option: SelectOption) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [place, setPlace] = useState<Placement | null>(null)
  const [phone, setPhone] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)

  // Sorted A–Z inside each group, groups in the order the caller gave them.
  const ordered = useMemo(() => {
    if (!sort) return options
    const groups: string[] = []
    for (const o of options) if (!groups.includes(o.group ?? '')) groups.push(o.group ?? '')
    return groups.flatMap((g) =>
      options.filter((o) => (o.group ?? '') === g).sort((a, b) => collator.compare(a.label, b.label)))
  }, [options, sort])

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const shown = ordered.filter((o) => matches(o, words))
  const typed = query.trim()
  const canCreate = Boolean(onCreate && typed && !options.some((o) => o.label.toLowerCase() === typed.toLowerCase()))
  // What the arrow keys move through, in display order.
  const rows: ({ kind: 'empty' } | { kind: 'option'; option: SelectOption } | { kind: 'create' })[] = [
    ...(emptyOption && !words.length ? [{ kind: 'empty' as const }] : []),
    ...shown.map((option) => ({ kind: 'option' as const, option })),
    ...(canCreate ? [{ kind: 'create' as const }] : []),
  ]

  const close = () => { setOpen(false); setQuery('') }

  const reposition = () => {
    const box = trigger.current?.getBoundingClientRect()
    if (!box) return
    const narrow = isPhone()
    setPhone(narrow)
    if (narrow) return setPlace(null)
    const width = Math.min(Math.max(box.width, 280), window.innerWidth - 16)
    const left = Math.max(8, Math.min(box.left, window.innerWidth - width - 8))
    const below = window.innerHeight - box.bottom - 12
    const above = box.top - 12
    // Search box and footer take about 110px of the panel; rows are about 48px.
    const chrome = footer ? 110 : 64
    const wanted = Math.min(320, rows.length * 48 + 8) + chrome
    // Open upwards only when the list would be cut short below and there is more room above.
    if (below < wanted && above > below) {
      setPlace({ bottom: window.innerHeight - box.top + 6, left, width, listMax: Math.min(320, above - chrome) })
    } else {
      setPlace({ top: box.bottom + 6, left, width, listMax: Math.min(320, Math.max(120, below - chrome)) })
    }
  }

  useLayoutEffect(() => {
    if (!open) return
    reposition()
    const onMove = (e: Event) => { if (!panel.current?.contains(e.target as Node)) reposition() }
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open])

  // Focus the search box once the panel is on screen. Bringing the keyboard up
  // on a phone hides most of the list, so only on desktop.
  const placed = Boolean(place)
  useEffect(() => {
    if (open && placed && !phone) search.current?.focus()
  }, [open, placed, phone])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (!trigger.current?.contains(t) && !panel.current?.contains(t)) close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  // Start the cursor on the chosen option.
  useEffect(() => {
    if (!open) return
    const i = rows.findIndex((r) => (r.kind === 'option' ? r.option.value === value : r.kind === 'empty' && !value))
    setCursor(Math.max(0, i))
  }, [open])

  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor, open])

  const pick = (row: (typeof rows)[number]) => {
    if (row.kind === 'empty') onChange('')
    else if (row.kind === 'option') onChange(row.option.value)
    else onCreate?.(typed)
    close()
    trigger.current?.focus()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, rows.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[cursor]) pick(rows[cursor]) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); trigger.current?.focus() }
  }

  const pad = size === 'sm' ? 'py-1.5' : 'py-2'
  let lastGroup: string | undefined

  const body = (
    <>
      <div className="border-b border-stone-100 p-2">
        <label className="relative block">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            ref={search}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0) }}
            onKeyDown={onKey}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="input border-0 bg-stone-50 pl-9 shadow-none focus:ring-2"
          />
        </label>
      </div>
      <div
        ref={list}
        role="listbox"
        className="overflow-y-auto overscroll-contain py-1"
        style={{ maxHeight: phone ? 'calc(70vh - 120px)' : place?.listMax ?? 320 }}
      >
        {rows.map((row, i) => {
          const active = i === cursor
          if (row.kind === 'empty') {
            return (
              <button
                key="__empty" type="button" role="option" aria-selected={!value} data-active={active}
                onMouseEnter={() => setCursor(i)} onClick={() => pick(row)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${active ? 'bg-brand-50' : ''} ${!value ? 'font-semibold text-brand-800' : 'text-stone-600'}`}
              >
                <span className="flex-1">{emptyOption}</span>
                {!value && <Icon name="check" className="h-4 w-4 text-brand-600" />}
              </button>
            )
          }
          if (row.kind === 'create') {
            return (
              <button
                key="__create" type="button" data-active={active}
                onMouseEnter={() => setCursor(i)} onClick={() => pick(row)}
                className={`flex w-full items-center gap-2 border-t border-stone-100 px-4 py-2.5 text-left text-sm font-semibold text-brand-700 ${active ? 'bg-brand-50' : ''}`}
              >
                <Icon name="plus" className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">{createLabel ? createLabel(typed) : `Add “${typed}”`}</span>
              </button>
            )
          }
          const { option } = row
          const header = option.group && option.group !== lastGroup
          lastGroup = option.group
          const on = option.value === value
          return (
            <div key={option.value}>
              {header && <p className="px-4 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">{option.group}</p>}
              <button
                type="button" role="option" aria-selected={on} data-active={active}
                onMouseEnter={() => setCursor(i)} onClick={() => pick(row)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left ${active ? 'bg-brand-50' : on ? 'bg-brand-50/60' : ''}`}
              >
                {option.avatar && <Avatar name={option.label} size="sm" src={typeof option.avatar === 'string' ? option.avatar : undefined} />}
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${on ? 'font-semibold text-brand-800' : 'font-medium text-stone-800'}`}>{option.label}</span>
                  {option.sub && <span className="block truncate text-xs text-stone-400">{option.sub}</span>}
                </span>
                {option.badge}
                {on && <Icon name="check" className="h-4 w-4 shrink-0 text-brand-600" />}
              </button>
            </div>
          )
        })}
        {shown.length === 0 && !canCreate && (
          <p className="px-4 py-6 text-center text-sm text-stone-400">
            {options.length === 0 ? 'Nothing to choose from yet.' : <>Nothing matches “{typed}”.</>}
          </p>
        )}
      </div>
      {footer?.(close, typed)}
    </>
  )

  return (
    <>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(true) }
        }}
        className={`flex w-full min-w-0 items-center gap-2 rounded-xl border bg-white px-3 ${pad} text-left text-sm shadow-sm transition disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500 ${
          open ? 'border-brand-500 ring-4 ring-brand-500/15' : 'border-stone-300 hover:border-stone-400'
        } ${className}`}
      >
        <span className="min-w-0 flex-1">
          {selected
            ? renderValue?.(selected) ?? <span className="block truncate text-stone-900">{selected.label}</span>
            : <span className={`block truncate ${emptyOption ? 'text-stone-700' : 'text-stone-400'}`}>{emptyOption ?? placeholder}</span>}
        </span>
        <Icon name="chevron" className={`h-4 w-4 shrink-0 text-stone-400 transition ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>

      {open && createPortal(
        phone ? (
          <div className="fixed inset-0 z-[70]">
            <div className="absolute inset-0 bg-stone-950/40" onClick={close} />
            <div
              ref={panel}
              className="absolute inset-x-3 top-3 flex max-h-[80vh] animate-fade-in flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
                <p className="truncate text-sm font-semibold text-stone-900">{title ?? ariaLabel ?? placeholder}</p>
                <button type="button" onClick={close} className="btn-icon -mr-1.5" aria-label="Close">
                  <Icon name="x" className="h-5 w-5" />
                </button>
              </div>
              {body}
            </div>
          </div>
        ) : place && (
          <div
            ref={panel}
            className="fixed z-[70] flex animate-fade-in flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
            style={{ top: place.top, bottom: place.bottom, left: place.left, width: place.width }}
          >
            {body}
          </div>
        ),
        document.body,
      )}
    </>
  )
}
