import type { ID, Payment, PaymentRequest, Project } from './types'

export interface Receivable {
  contracted: number
  received: number
  /** Contract value not yet received. */
  outstanding: number
  /** Payment requests approved and raised with the client but not yet paid. */
  dueNow: number
}

/** What a client owes across their projects, or one project when `projectId` is set. */
export function receivable(
  data: { projects: Project[]; payments: Payment[]; paymentRequests: PaymentRequest[] },
  clientId: ID,
  projectId?: ID,
): Receivable {
  const projects = data.projects.filter(
    (p) => p.clientId === clientId && (!projectId || p.id === projectId),
  )
  const ids = new Set(projects.map((p) => p.id))
  const contracted = projects.reduce((sum, p) => sum + p.value, 0)
  const received = data.payments
    .filter((p) => ids.has(p.projectId))
    .reduce((sum, p) => sum + p.amount, 0)
  const dueNow = data.paymentRequests
    .filter((r) => ids.has(r.projectId) && r.status === 'Approved')
    .reduce((sum, r) => sum + r.amount, 0)
  return { contracted, received, outstanding: Math.max(0, contracted - received), dueNow }
}
