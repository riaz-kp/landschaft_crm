import type { PayRecord } from './types'

export interface PaySummary {
  /** What the days worked so far this month are worth. */
  earned: number
  /** Salary or wages already paid against the month. */
  paid: number
  advances: number
  ta: number
  bonus: number
  deductions: number
  /** Earned, less what has been paid, advanced or deducted. */
  balance: number
  /** How `earned` was worked out, for the screen. */
  basis: string
}

/**
 * One person's pay for a month. Salaried staff earn their salary pro rata to
 * the days worked against the month's working days; site workers earn their
 * day rate per day. Half days count as half.
 */
export function paySummary(input: {
  records: PayRecord[]
  month: string
  daysWorked: number
  workingDays: number
  monthlySalary?: number
  dailyWage?: number
}): PaySummary {
  const { records, month, daysWorked, workingDays, monthlySalary, dailyWage } = input
  const sum = (types: PayRecord['type'][]) =>
    records.filter((r) => r.period === month && types.includes(r.type)).reduce((s, r) => s + r.amount, 0)

  let earned = 0
  let basis = 'No salary or day rate set'
  if (monthlySalary) {
    earned = workingDays ? Math.round((monthlySalary * daysWorked) / workingDays) : 0
    basis = `${daysWorked} of ${workingDays} working days × ₹${monthlySalary.toLocaleString('en-IN')} a month`
  } else if (dailyWage) {
    earned = Math.round(daysWorked * dailyWage)
    basis = `${daysWorked} days × ₹${dailyWage.toLocaleString('en-IN')} a day`
  }

  const paid = sum(['Salary', 'Wages'])
  const advances = sum(['Advance'])
  const deductions = sum(['Deduction'])
  return {
    earned, paid, advances, ta: sum(['TA']), bonus: sum(['Bonus']), deductions,
    balance: earned - paid - advances - deductions, basis,
  }
}

export const PAY_TONE: Record<PayRecord['type'], 'green' | 'amber' | 'blue' | 'violet' | 'red' | 'stone'> = {
  Salary: 'green', Wages: 'green', Advance: 'amber', TA: 'blue', Bonus: 'violet', Deduction: 'red',
}
