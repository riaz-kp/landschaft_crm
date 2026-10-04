import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { ROLES } from '../domain/roles'
import type { Employee, Role, RoleKey } from '../domain/types'
import { useDb } from './useDb'

interface SessionValue {
  user: Employee
  role: Role
  roleKey: RoleKey
  signInAs: (employeeId: string) => void
  /** Everyone who can be impersonated in the prototype's role switcher. */
  people: Employee[]
}

const SessionContext = createContext<SessionValue | null>(null)

const STORAGE_KEY = 'landschaft-crm-session'

export function SessionProvider({ children }: { children: ReactNode }) {
  // Read from the store rather than the seed, so profile edits show up here too.
  const { employees } = useDb()
  const [userId, setUserId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) ?? 'e1' // Ashfaq — CEO / Ops
  })

  const value = useMemo<SessionValue>(() => {
    const user = employees.find((e) => e.id === userId) ?? employees[1]
    return {
      user,
      role: ROLES[user.role],
      roleKey: user.role,
      people: employees,
      signInAs: (id: string) => {
        localStorage.setItem(STORAGE_KEY, id)
        setUserId(id)
      },
    }
  }, [userId, employees])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}
