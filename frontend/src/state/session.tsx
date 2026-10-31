import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { ROLES } from '../domain/roles'
import type { Employee, Role, RoleKey } from '../domain/types'
import {
  DEMO_MODE, forgetStoredLogin, isNetworkError, staffAccounts, storedLoginUserId, supabase, supabaseConfigured,
} from '../lib/supabase'
import { closeSession, flushNow, forgetOfflineCopy, offlineCopyFor, openSession } from '../data/sync'
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

  const open = useCallback(async (userId: string, employeeId: string) => {
    await openSession(userId, employeeId)
    if (loadedFor.current === userId) setPhase({ kind: 'ready', employeeId })
  }, [])

  const begin = useCallback(async (user: User) => {
    loadedFor.current = user.id
    setPhase({ kind: 'loading' })
    try {
      const { data: link, error } = await supabase()
        .from('app_users').select('employee_id, active').eq('user_id', user.id).maybeSingle()
      if (error) {
        // No connection: open on the copy kept on this device, if there is a recent one.
        const employeeId = isNetworkError(error) ? await offlineCopyFor(user.id) : null
        if (!employeeId) throw error
        return await open(user.id, employeeId)
      }
      if (!link?.active) {
        void forgetOfflineCopy()
        return setPhase({ kind: 'no-access', email: user.email })
      }
      await open(user.id, link.employee_id)
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error).message })
    }
  }, [open])

  /**
   * Supabase reports no session when an expired sign-in cannot be renewed for
   * want of a connection, though the login is still stored here. Then the copy
   * on this device opens; the sign-in renews by itself once the server answers.
   */
  const beginOffline = useCallback(async (userId: string): Promise<boolean> => {
    const employeeId = await offlineCopyFor(userId)
    if (!employeeId) return false
    loadedFor.current = userId
    setPhase({ kind: 'loading' })
    try {
      await open(userId, employeeId)
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error).message })
    }
    return true
  }, [open])

  const signOut = useCallback(async () => {
    await flushNow()
    // The copy of the data on this device goes first, whether or not the server can be reached.
    await forgetOfflineCopy()
    const { error } = await supabase().auth.signOut()
    if (error) {
      // Offline with an expired sign-in Supabase refuses; drop the stored login here all the same.
      forgetStoredLogin()
      window.location.reload()
    }
  }, [])

  useEffect(() => {
    const { data } = supabase().auth.onAuthStateChange((_event, session) => {
      // Supabase asks that nothing awaits inside this callback, so the work runs just after it.
      setTimeout(() => {
        userRef.current = session?.user ?? null
        if (session) {
          if (loadedFor.current !== session.user.id) void begin(session.user)
          return
        }
        const stored = storedLoginUserId()
        if (stored && loadedFor.current === stored) return
        void (async () => {
          if (stored && await beginOffline(stored)) return
          loadedFor.current = null
          void closeSession()
          // Signed out, or the login was ended: nothing of the CRM stays on this device.
          if (!stored) void forgetOfflineCopy()
          void showSignIn()
        })()
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [begin, beginOffline, showSignIn])

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
