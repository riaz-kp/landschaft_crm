import type { ReportWorkerEntry, Worker } from '../domain/types'

/**
 * Ticking workers is what sets the headcount — the client's paper form asked
 * foremen to write names out by hand and then total them, which is exactly the
 * step this removes.
 */
export function WorkerPicker({
  workers, attendance, onChange, disabled,
}: {
  workers: Worker[]
  attendance: ReportWorkerEntry[]
  onChange: (next: ReportWorkerEntry[]) => void
  disabled?: boolean
}) {
  const toggle = (workerId: string, present: boolean) => {
    onChange(
      attendance.map((entry) =>
        entry.workerId === workerId
          ? { ...entry, present, checkIn: present ? entry.checkIn : undefined, checkOut: present ? entry.checkOut : undefined }
          : entry,
      ),
    )
  }

  const isPresent = (workerId: string) =>
    attendance.find((entry) => entry.workerId === workerId)?.present ?? false

  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {workers.map((worker) => {
        const present = isPresent(worker.id)
        return (
          <label
            key={worker.id}
            className={`flex cursor-pointer select-none items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
              present ? 'border-brand-300 bg-brand-50' : 'border-stone-200 bg-white hover:bg-stone-50'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              type="checkbox"
              checked={present}
              disabled={disabled}
              onChange={(e) => toggle(worker.id, e.target.checked)}
              className="h-5 w-5 shrink-0 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-stone-800">{worker.name}</span>
              <span className="block truncate text-xs text-stone-500">{worker.skill}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
