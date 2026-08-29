import { Icon } from './Icon'

/**
 * The numbered, add-as-you-go list used by Work Done, Issues and Next Day Plan
 * in the foreman's report — the paper form has numbered blanks with room to
 * add more, and this reproduces that.
 */
export function RepeaterList({
  values, onChange, addLabel, placeholder, minRows = 1, disabled,
}: {
  values: string[]
  onChange: (next: string[]) => void
  addLabel: string
  placeholder?: string
  minRows?: number
  disabled?: boolean
}) {
  const rows = values.length >= minRows ? values : [...values, ...Array(minRows - values.length).fill('')]

  const setAt = (index: number, value: string) => {
    const next = [...rows]
    next[index] = value
    onChange(next)
  }

  const removeAt = (index: number) => {
    const next = rows.filter((_, i) => i !== index)
    onChange(next.length ? next : [''])
  }

  return (
    <div className="space-y-2">
      {rows.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-right text-sm font-medium tabular-nums text-stone-400">
            {index + 1}.
          </span>
          <input
            type="text"
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => setAt(index, e.target.value)}
            className="input"
          />
          {rows.length > 1 && !disabled && (
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="shrink-0 rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-red-600"
              aria-label={`Remove line ${index + 1}`}
            >
              <Icon name="trash" className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...rows, ''])}
          className="ml-7 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          <Icon name="plus" className="h-4 w-4" />
          {addLabel}
        </button>
      )}
    </div>
  )
}

/** Read-only rendering of the same list, for review and history screens. */
export function RepeaterView({ values, empty = '—' }: { values: string[]; empty?: string }) {
  const filled = values.filter((v) => v.trim())
  if (filled.length === 0) return <p className="text-sm text-stone-400">{empty}</p>
  return (
    <ol className="space-y-1">
      {filled.map((value, index) => (
        <li key={index} className="flex gap-2 text-sm text-stone-700">
          <span className="shrink-0 tabular-nums text-stone-400">{index + 1}.</span>
          <span>{value}</span>
        </li>
      ))}
    </ol>
  )
}
