const pad = (n: number) => String(n).padStart(2, '0')

/**
 * A 12-hour time field — hour, minute and AM/PM. Built from plain selects, so
 * a phone shows its own wheel picker. The value is always stored as 24-hour
 * HH:mm.
 */
export function TimeInput({
  value, onChange, disabled, ariaLabel, step = 5, size = 'md',
}: {
  value: string
  onChange: (hhmm: string) => void
  disabled?: boolean
  ariaLabel: string
  /** Minutes between choices; the current value is always offered too. */
  step?: number
  size?: 'sm' | 'md'
}) {
  const [h, m] = value ? value.split(':').map(Number) : [NaN, NaN]
  const empty = Number.isNaN(h)
  const pm = !empty && h >= 12
  const hour12 = empty ? NaN : h % 12 === 0 ? 12 : h % 12

  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step)
  if (!empty && !minutes.includes(m)) minutes.push(m)
  minutes.sort((a, b) => a - b)

  const emit = (hour24: number, minute: number) => onChange(`${pad(hour24)}:${pad(minute)}`)
  const to24 = (h12: number, isPm: boolean) => (h12 % 12) + (isPm ? 12 : 0)

  const select = `appearance-none bg-transparent text-center font-semibold tabular-nums text-stone-900 focus:outline-none disabled:text-stone-500 ${
    size === 'sm' ? 'px-0.5 py-1 text-sm' : 'px-1.5 py-2 text-base'
  }`

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex w-full min-w-0 items-center justify-between gap-1 rounded-xl border border-stone-300 bg-white pr-1 shadow-sm focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15 ${
        size === 'sm' ? 'pl-1.5' : 'pl-2'
      } ${disabled ? 'bg-stone-100' : ''}`}
    >
      <span className="flex items-center">
        <select
          className={select} disabled={disabled} aria-label={`${ariaLabel} — hour`}
          value={empty ? '' : hour12}
          onChange={(e) => {
            const picked = Number(e.target.value)
            // A first pick guesses working hours: 7–11 morning, 12–6 afternoon.
            emit(to24(picked, empty ? picked < 7 || picked === 12 : pm), empty ? 0 : m)
          }}
        >
          {empty && <option value="">--</option>}
          {Array.from({ length: 12 }, (_, i) => i + 1).map((i) => <option key={i} value={i}>{pad(i)}</option>)}
        </select>
        <span className="font-semibold text-stone-400">:</span>
        <select
          className={select} disabled={disabled} aria-label={`${ariaLabel} — minute`}
          value={empty ? '' : m}
          onChange={(e) => emit(empty ? 8 : h, Number(e.target.value))}
        >
          {empty && <option value="">--</option>}
          {minutes.map((i) => <option key={i} value={i}>{pad(i)}</option>)}
        </select>
      </span>

      <span className={`flex shrink-0 rounded-lg bg-stone-100 p-0.5 font-bold ${size === 'sm' ? 'text-[10px]' : 'text-[11px]'}`}>
        {(['AM', 'PM'] as const).map((half) => {
          const on = !empty && (half === 'PM') === pm
          return (
            <button
              key={half}
              type="button"
              disabled={disabled}
              onClick={() => emit(to24(empty ? 8 : hour12, half === 'PM'), empty ? 0 : m)}
              className={`rounded-md py-1 transition ${size === 'sm' ? 'px-1' : 'px-1.5'} ${on ? 'bg-white text-brand-800 shadow-sm' : 'text-stone-400 hover:text-stone-700'} disabled:cursor-not-allowed`}
              aria-pressed={on}
            >
              {half}
            </button>
          )
        })}
      </span>
    </div>
  )
}
