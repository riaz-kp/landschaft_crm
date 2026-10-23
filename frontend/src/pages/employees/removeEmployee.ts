import { api } from '../../api/client'
import { DEMO_MODE, staffAccounts } from '../../lib/supabase'
import type { Employee } from '../../domain/types'

/**
 * Deletes an employee, and their login with them. Returns false — leaving the
 * employee in place — when the login could not be removed.
 */
export async function removeEmployee(employee: Employee): Promise<boolean> {
  if (!DEMO_MODE) {
    try {
      await staffAccounts({ action: 'remove', employeeId: employee.id })
    } catch (e) {
      window.alert(`${employee.name} was not deleted: ${(e as Error).message}`)
      return false
    }
  }
  api.employees.remove(employee.id)
  return true
}
