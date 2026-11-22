import { useCallback, useMemo, useState } from 'react'
import { Icon } from './Icon'

export type SortDir = 'asc' | 'desc'

/** One way a list can be ordered: its label, the value each row is compared by, and the direction it starts in. */
export interface SortOption<T> {
  key: string
  label: string
  value: (row: T) => string | number | undefined | null
  /** Dates and amounts usually read newest / largest first. */
  dir?: SortDir
}

export interface SortState { key: string; dir: SortDir }

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

function readStored(id: string): SortState | null {
  try {
    const raw = localStorage.getItem(`sort:${id}`)
    return raw ? (JSON.parse(raw) as SortState) : null
  } catch {
    return null
  }
}

/** Sorts a copy of the rows. Rows with no value always go last, whichever way the list runs. */
export function sortRows<T>(rows: T[], option: SortOption<T> | undefined, dir: SortDir): T[] {
  if (!option) return rows
  const sign = dir === 'asc' ? 1 : -1
  return rows
    .map((row, index) => ({ row, index, value: option.value(row) }))
    .sort((a, b) => {
      const empty = (v: unknown) => v === undefined || v === null || v === ''
      if (empty(a.value) || empty(b.value)) {
        if (empty(a.value) && empty(b.value)) return a.index - b.index
        return empty(a.value) ? 1 : -1
      }
      const diff = typeof a.value === 'number' && typeof b.value === 'number'
        ? a.value - b.value
        : collator.compare(String(a.value), String(b.value))
      // Equal values keep the order the page already had.
      return sign * diff || a.index - b.index
    })
    .map((x) => x.row)
}

/**
 * A list's sort order, remembered on this device per list. Returns the sort
 * function and the picker to put in the list's toolbar.
 *
 *   const { sort, control } = useSort('projects', [...options])
 *   const rows = sort(filtered)
 */
export function useSort<T>(id: string, options: SortOption<T>[], initial?: SortState) {
  const fallback = initial ?? { key: options[0].key, dir: options[0].dir ?? 'asc' }
  const [state, setState] = useState<SortState>(() => {
    const stored = readStored(id)
    return stored && options.some((o) => o.key === stored.key) ? stored : fallback
  })

  const set = useCallback((next: SortState) => {
    setState(next)
    try { localStorage.setItem(`sort:${id}`, JSON.stringify(next)) } catch { /* remembered for this visit only */ }
  }, [id])

  const option = options.find((o) => o.key === state.key) ?? options[0]
  const sort = useCallback((rows: T[]) => sortRows(rows, option, state.dir), [option, state.dir])

  const control = useMemo(() => (
    <SortPicker
      options={options.map((o) => ({ key: o.key, label: o.label, dir: o.dir }))}
      state={{ key: option.key, dir: state.dir }}
      onChange={set}
    />
  ), [options, option.key, state.dir, set])

  return { sort, control, state }
}

/** Sort picker with an ascending / descending toggle. */
export function SortPicker({
  options, state, onChange, className = '',
}: {
  options: { key: string; label: string; dir?: SortDir }[]
  state: SortState
  onChange: (s: SortState) => void
  className?: string
}) {
  return (
    <div className={`flex min-w-0 shrink-0 gap-1 ${className}`}>
      <label className="relative min-w-0 flex-1">
        <Icon name="sort" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <select
          className="input py-1.5 pl-8 sm:w-44"
          value={state.key}
          onChange={(e) => {
            const next = options.find((o) => o.key === e.target.value)
            onChange({ key: e.target.value, dir: next?.dir ?? 'asc' })
          }}
          aria-label="Sort by"
          title="Sort by"
        >
          {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>
      <button
        type="button"
        onClick={() => onChange({ ...state, dir: state.dir === 'asc' ? 'desc' : 'asc' })}
        className="btn-secondary shrink-0 px-2.5 py-1.5"
        title={state.dir === 'asc' ? 'Ascending — tap for descending' : 'Descending — tap for ascending'}
        aria-label={state.dir === 'asc' ? 'Sorted ascending' : 'Sorted descending'}
      >
        <Icon name={state.dir === 'asc' ? 'arrowUp' : 'arrowDown'} className="h-4 w-4" />
      </button>
    </div>
  )
}
