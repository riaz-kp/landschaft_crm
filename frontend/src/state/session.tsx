import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { ROLES } from '../domain/roles'
import type { Employee, Role, RoleKey } from '../domain/types'
import { DEMO_MODE, staffAccounts, supabase, supabaseConfigured } from '../lib/supabase'
import { closeSession, flushNow, openSession } from '../data/sync'
import { openDemo } from '../data/demo'
import { useDb } from './useDb'
import {
  FirstAdminSetup, LoadError, NoAccessScreen, NotConfigured, SignIn, Splash,
} from '../pages/auth/AuthScreens'

interface SessionValue {
  user: Employee
  role: Role
  roleKey: RoleKey
  /** Sends anything still waiting, then signs out. */
  signOut: () => Promise<void>
  /** The offline demo only: view the app as anyone in the org chart. */
  demo?: { people: Employee[]; signInAs: (employeeId: string) => void }
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  if (DEMO_MODE) return <DemoSession>{children}</DemoSession>
  if (!supabaseConfigured) return <NotConfigured />
  return <SupabaseSession>{children}</SupabaseSession>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}

/** Provides the session once the signed-in employee is in the store. */
function Signed({ employeeId, signOut, demo, children }: {
  employeeId: string
  signOut: () => Promise<void>
  demo?: (people: Employee[]) => SessionValue['demo']
  children: ReactNode
}) {
  // Read from the store, so profile edits show up here too.
  const { employees } = useDb()
  const user = employees.find((e) => e.id === employeeId)
  const value = useMemo<SessionValue | null>(() => user ? {
    user,
    role: ROLES[user.role],
    roleKey: user.role,
    signOut,
    demo: demo?.(employees),
  } : null, [user, employees, signOut, demo])

  // Their employee record was deleted while they were signed in.
  if (!value) return <NoAccessScreen email={user?.email} onSignOut={() => void signOut()} />
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

// ---------------------------------------------------------------- demo

const DEMO_SESSION_KEY = 'landschaft-crm-session'

function DemoSession({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [userId, setUserId] = useState(() => localStorage.getItem(DEMO_SESSION_KEY) ?? 'e1') // Ashfaq — CEO / Ops

  useEffect(() => {
    void openDemo().then(() => setReady(true))
  }, [])

  const signInAs = useCallback((id: string) => {
    localStorage.setItem(DEMO_SESSION_KEY, id)
    setUserId(id)
  }, [])
  const signOut = useCallback(async () => signInAs('e1'), [signInAs])
  const demo = useCallback((people: Employee[]) => ({ people, signInAs }), [signInAs])

  if (!ready) return <Splash message="Loading the demo…" />
  return <Signed employeeId={userId} signOut={signOut} demo={demo}>{children}</Signed>
}

// ---------------------------------------------------------------- Supabase

type Phase =
  | { kind: 'starting' }
  | { kind: 'signed-out'; needsSetup: boolean }
  | { kind: 'loading' }
  | { kind: 'no-access'; email?: string }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; employeeId: string }

function SupabaseSession({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'starting' })
  const userRef = useRef<User | null>(null)
  // The user whose data is loaded or loading, so token refreshes do not reload it.
  const loadedFor = useRef<string | null>(null)

  // Sign-in shows at once; the first-admin set-up replaces it only on a CRM with no logins yet.
  const showSignIn = useCallback(async () => {
    setPhase({ kind: 'signed-out', needsSetup: false })
    const needsSetup = await staffAccounts<{ needsSetup: boolean }>({ action: 'status' })
      .then((r) => r.needsSetup).catch(() => false)
    if (needsSetup) setPhase((now) => (now.kind === 'signed-out' ? { kind: 'signed-out', needsSetup } : now))
  }, [])

  const begin = useCallback(async (user: User) => {
    loadedFor.current = user.id
    setPhase({ kind: 'loading' })
    try {
      const { data: link, error } = await supabase()
        .from('app_users').select('employee_id, active').eq('user_id', user.id).maybeSingle()
      if (error) throw error
      if (!link?.active) return setPhase({ kind: 'no-access', email: user.email })
      await openSession(user.id, link.employee_id)
      if (loadedFor.current === user.id) setPhase({ kind: 'ready', employeeId: link.employee_id })
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error).message })
    }
  }, [])

  const signOut = useCallback(async () => {
    await flushNow()
    await supabase().auth.signOut()
  }, [])

  useEffect(() => {
    const { data } = supabase().auth.onAuthStateChange((_event, session) => {
      // Supabase asks that nothing awaits inside this callback, so the work runs just after it.
      setTimeout(() => {
        userRef.current = session?.user ?? null
        if (!session) {
          loadedFor.current = null
          void closeSession()
          void showSignIn()
        } else if (loadedFor.current !== session.user.id) {
          void begin(session.user)
        }
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [begin, showSignIn])

  switch (phase.kind) {
    case 'starting':
    case 'loading':
      return <Splash />
    case 'signed-out':
      return phase.needsSetup ? <FirstAdminSetup onDone={() => setPhase({ kind: 'loading' })} /> : <SignIn />
    case 'no-access':
      return <NoAccessScreen email={phase.email} onSignOut={() => void signOut()} />
    case 'error':
      return (
        <LoadError
          message={phase.message}
          onRetry={() => userRef.current && void begin(userRef.current)}
          onSignOut={() => void signOut()}
        />
      )
    case 'ready':
      return <Signed employeeId={phase.employeeId} signOut={signOut}>{children}</Signed>
  }
}
