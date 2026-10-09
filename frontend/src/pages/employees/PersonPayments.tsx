import { useMemo, useState } from 'react'
import { api } from '../../api/client'
import { useDb } from '../../state/useDb'
import { useSession } from '../../state/session'
import { formatCurrency, formatDate, today } from '../../domain/format'
import { daysOfMonth, indexRegister, indexWorkerReports, isOffDay, resolveDay, totalsFor } from '../../domain/attendance'
import { PAY_TONE, paySummary, type PaySummary } from '../../domain/pay'
import type { ID, PayRecord, PayType, PersonKind } from '../../domain/types'
import { Badge, ConfirmDialog, EmptyState, Field, FormError, Modal, Section, StatTile, Table } from '../../components/ui'
import { Icon } from '../../components/Icon'

const PAY_TYPES: PayType[] = ['Salary', 'Wages', 'Advance', 'TA', 'Bonus', 'Deduction']
const METHODS: PayRecord['method'][] = ['Bank Transfer', 'UPI', 'Cash', 'Cheque']

export function monthLabel(month: string): string {
  return new Date(month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/** Days worked and the month's working days, from the attendance register (and daily reports for workers). */
export function useMonthPay(kind: PersonKind, personId: ID, month: string, rate: { monthlySalary?: number; dailyWage?: number }): PaySummary & { daysWorked: number; workingDays: number } {
  const db = useDb()
  const register = useMemo(() => indexRegister(db.attendance), [db.attendance])
  const workerReports = useMemo(() => indexWorkerReports(db.reports), [db.reports])
  const days = daysOfMonth(month)
  const worked = totalsFor(
    days.filter((d) => d <= today()).map((date) => ({ date, day: resolveDay(kind, personId, date, register, workerReports) })),
    db.settings.holidays,
  ).days
  const workingDays = days.filter((d) => !isOffDay(d, db.settings.holidays)).length
  const records = db.payRecords.filter((r) => r.kind === kind && r.personId === personId)
  return { ...paySummary({ records, month, daysWorked: worked, workingDays, ...rate }), daysWorked: worked, workingDays }
}

function shift(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Salary or wages for one person: the month's summary — earned from
 * attendance, paid, advanced, balance — and every payment recorded.
 */
export function PersonPayments({
  kind, personId, monthlySalary, dailyWage, canManage,
}: { kind: PersonKind; personId: ID; monthlySalary?: number; dailyWage?: number; canManage: boolean }) {
  const db = useDb()
  const [month, setMonth] = useState(today().slice(0, 7))
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<PayRecord | null>(null)
  const s = useMonthPay(kind, personId, month, { monthlySalary, dailyWage })
  const records = db.payRecords
    .filter((r) => r.kind === kind && r.personId === personId)
    .sort((a, b) => b.date.localeCompare(a.date))
  const payer = (id: ID) => db.employees.find((e) => e.id === id)?.name ?? '—'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(shift(month, -1))} className="btn-icon" aria-label="Previous month"><Icon name="chevron" className="h-4 w-4 rotate-180" /></button>
          <h3 className="w-44 text-center font-semibold text-stone-900">{monthLabel(month)}</h3>
          <button onClick={() => setMonth(shift(month, 1))} disabled={month >= today().slice(0, 7)} className="btn-icon disabled:opacity-30" aria-label="Next month"><Icon name="chevron" className="h-4 w-4" /></button>
        </div>
        {canManage && (
          <button onClick={() => setAdding(true)} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> Record payment</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Days Worked" value={s.daysWorked} sub={`of ${s.workingDays} working days`} icon="calendar" />
        <StatTile label={month === today().slice(0, 7) ? 'Earned So Far' : 'Earned'} value={formatCurrency(s.earned)} tone="green" icon="rupee" sub={s.basis} />
        <StatTile label={kind === 'worker' ? 'Wages Paid' : 'Salary Paid'} value={formatCurrency(s.paid)} tone="blue" icon="check" />
        <StatTile label="Advances" value={formatCurrency(s.advances)} tone={s.advances ? 'amber' : 'stone'} icon="wallet" />
        <StatTile label={s.balance >= 0 ? 'Balance Due' : 'Overpaid'} value={formatCurrency(Math.abs(s.balance))} tone={s.balance > 0 ? 'clay' : 'stone'} icon="wallet" sub={s.ta || s.bonus ? `+ ${formatCurrency(s.ta + s.bonus)} TA / bonus paid` : undefined} />
      </div>

      <Section title="Payments" description={`${records.length} recorded`}>
        {records.length === 0 ? (
          <EmptyState title="No payments recorded yet." icon="wallet" />
        ) : (
          <Table head={['Date', 'Type', 'For', 'Amount', 'Method', 'Note', 'Paid by', '']}>
            {records.map((r) => (
              <tr key={r.id} className="row-hover">
                <td className="td whitespace-nowrap tabular-nums font-medium text-stone-900">{formatDate(r.date)}</td>
                <td className="td"><Badge tone={PAY_TONE[r.type]}>{r.type}</Badge></td>
                <td className="td whitespace-nowrap">{r.period ? monthLabel(r.period) : '—'}</td>
                <td className={`td font-semibold tabular-nums ${r.type === 'Deduction' ? 'text-red-700' : 'text-stone-900'}`}>
                  {r.type === 'Deduction' ? '−' : ''}{formatCurrency(r.amount)}
                </td>
                <td className="td">{r.method}</td>
                <td className="td max-w-xs">{r.note || '—'}</td>
                <td className="td whitespace-nowrap">{payer(r.paidBy)}</td>
                <td className="td text-right">
                  {canManage && (
                    <button onClick={() => setDeleting(r)} className="btn-icon hover:bg-red-50 hover:text-red-600" aria-label="Delete payment">
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      {adding && (
        <PaymentModal
          kind={kind} personId={personId} month={month}
          suggested={Math.max(0, s.balance)}
          onClose={() => setAdding(false)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this payment?"
          message={<>{deleting.type} of {formatCurrency(deleting.amount)} on {formatDate(deleting.date)} will be removed.</>}
          onClose={() => setDeleting(null)}
          onConfirm={() => api.pay.remove(deleting.id)}
        />
      )}
    </div>
  )
}

function PaymentModal({
  kind, personId, month, suggested, onClose,
}: { kind: PersonKind; personId: ID; month: string; suggested: number; onClose: () => void }) {
  const { user } = useSession()
  const [form, setForm] = useState({
    type: (kind === 'worker' ? 'Wages' : 'Salary') as PayType,
    amount: suggested ? String(suggested) : '',
    date: today(),
    period: month,
    method: (kind === 'worker' ? 'Cash' : 'Bank Transfer') as PayRecord['method'],
    note: '',
  })
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => { setForm({ ...form, ...patch }); setError(null) }

  const save = () => {
    const amount = Number(form.amount)
    if (!amount || amount <= 0) return setError('Enter the amount paid.')
    if (!form.date) return setError('Pick the payment date.')
    api.pay.create({
      kind, personId, date: form.date, amount, type: form.type, period: form.period || undefined,
      method: form.method, note: form.note.trim() || undefined, paidBy: user.id,
    })
    onClose()
  }

  return (
    <Modal
      title="Record a payment"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary">Save payment</button>
      </>}
    >
      <div className="space-y-4">
        <div>
          <p className="label mb-2">Type</p>
          <div className="flex flex-wrap gap-2">
            {PAY_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => set({ type: t })} className={`chip px-3 py-1.5 text-sm ${form.type === t ? 'chip-on' : ''}`}>{t}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₹)" required>
            <input type="number" min={0} className="input" value={form.amount} onChange={(e) => set({ amount: e.target.value })} autoFocus />
          </Field>
          <Field label="Paid on" required>
            <input type="date" className="input" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="For the month">
            <input type="month" className="input" value={form.period} onChange={(e) => set({ period: e.target.value })} />
          </Field>
          <Field label="Method">
            <select className="input" value={form.method} onChange={(e) => set({ method: e.target.value as PayRecord['method'] })}>
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Note">
          <input className="input" value={form.note} placeholder="e.g. Festival advance" onChange={(e) => set({ note: e.target.value })} />
        </Field>
        <FormError message={error} />
      </div>
    </Modal>
  )
}
