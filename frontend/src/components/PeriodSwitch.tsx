import { createContext, useContext, useState, type ReactNode } from 'react'
import { DASHBOARD_PERIODS, PERIOD_LABELS, describeRange, rangeOf, type DateRange, type PeriodKey } from '../domain/period'

interface PeriodValue {
  period: PeriodKey
  range: DateRange
  setPeriod: (p: PeriodKey) => void
}

const PeriodContext = createContext<PeriodValue | null>(null)
const STORAGE_KEY = 'landschaft-dashboard-period'
const SHORT: Partial<Record<PeriodKey, string>> = { today: 'Today', week: 'Week', month: 'Month', year: 'Year' }

function stored(): PeriodKey {
  try {
    const value = localStorage.getItem(STORAGE_KEY) as PeriodKey | null
    return value && DASHBOARD_PERIODS.includes(value) ? value : 'today'
  } catch {
    return 'today'
  }
}

/** Holds the dashboard's time window; remembered between visits in this browser. */
export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriodState] = useState<PeriodKey>(stored)
  const setPeriod = (p: PeriodKey) => {
    setPeriodState(p)
    try { localStorage.setItem(STORAGE_KEY, p) } catch { /* private mode */ }
  }
  return (
    <PeriodContext.Provider value={{ period, range: rangeOf(period)!, setPeriod }}>
      {children}
    </PeriodContext.Provider>
  )
}

export function useDashboardPeriod(): PeriodValue {
  const value = useContext(PeriodContext)
  // Outside a provider (e.g. a dashboard rendered on its own) default to today.
  return value ?? { period: 'today', range: rangeOf('today')!, setPeriod: () => {} }
}

/** Today · This week · This month · This year — the dashboard's time filter. */
export function PeriodSwitch() {
  const { period, range, setPeriod } = useDashboardPeriod()
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-white p-1 shadow-card">
        {DASHBOARD_PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              period === p ? 'bg-brand-600 text-white shadow-sm' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
            }`}
          >
            {SHORT[p] ?? PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      <span className="px-1 text-[11px] text-stone-400">{describeRange(range)}</span>
    </div>
  )
}
