import { useEffect, useState, type FormEvent } from 'react'
import { DEMO_MODE, staffAccounts, supabase } from '../../lib/supabase'
import { formatDate } from '../../domain/format'
import type { Employee } from '../../domain/types'
import { Badge, Field, Section } from '../../components/ui'
import { Icon } from '../../components/Icon'

const MIN_PASSWORD = 8

interface Login {
  email: string
  active: boolean
  created_at: string
}

/** An employee's login: create it, set a new password, or switch it off and on. */
export function LoginAccess({ employee, isSelf }: { employee: Employee; isSelf: boolean }) {
  const [login, setLogin] = useState<Login | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'create' | 'password'>('view')
  const [email, setEmail] = useState(employee.email)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Bumped after each change, to read the login again.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (DEMO_MODE) return
    let live = true
    void supabase()
      .from('app_users').select('email, active, created_at').eq('employee_id', employee.id).maybeSingle()
      .then(({ data, error: failure }) => {
        if (!live) return
        if (failure) setLoadError(failure.message)
        else setLogin(data as Login | null)
      })
    return () => {
      live = false
    }
  }, [employee.id, version])

  const run = async (body: Record<string, unknown>, success: string) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await staffAccounts({ ...body, employeeId: employee.id })
      setNotice(success)
      setMode('view')
      setPassword('')
      setConfirm('')
      setVersion((v) => v + 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters for the password.`)
    if (password !== confirm) return setError('The two passwords do not match.')
    if (mode === 'create') {
      void run({ action: 'create', email: email.trim(), password }, `Login created. Give ${employee.name} the email and password in person; they can change the password from their account menu.`)
    } else {
      void run({ action: 'set-password', password }, `New password set. Let ${employee.name} know it in person.`)
    }
  }

  if (DEMO_MODE) {
    return (
      <Section title="Login">
        <p className="px-5 py-5 text-sm text-stone-500">Logins are not used in the demo — anyone can be picked from the account menu.</p>
      </Section>
    )
  }

  return (
    <Section
      title="Login"
      description="The email and password this person signs in with. Only someone who can edit Employees manages logins."
      actions={login && <Badge tone={login.active ? 'green' : 'red'}>{login.active ? 'Active' : 'Switched off'}</Badge>}
    >
      <div className="space-y-4 px-5 py-5">
        {loadError && <p className="text-sm text-red-600">Could not load the login: {loadError}</p>}
        {login === undefined && !loadError && <p className="text-sm text-stone-400">Loading…</p>}

        {notice && (
          <p className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
          </p>
        )}

        {login === null && mode === 'view' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-600">{employee.name} has no login yet, so they cannot sign in.</p>
            <button onClick={() => { setMode('create'); setNotice(null) }} className="btn-primary">
              <Icon name="plus" className="h-4 w-4" /> Create login
            </button>
          </div>
        )}

        {login && mode === 'view' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <dl className="text-sm">
              <dt className="text-stone-500">Signs in as</dt>
              <dd className="font-medium text-stone-900">{login.email}</dd>
              <dd className="mt-0.5 text-xs text-stone-400">Since {formatDate(login.created_at.slice(0, 10))}</dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setMode('password'); setNotice(null) }} className="btn-secondary">
                <Icon name="shield" className="h-4 w-4" /> Set new password
              </button>
              {!isSelf && (
                <button
                  disabled={busy}
                  onClick={() => void run(
                    { action: 'set-active', active: !login.active },
                    login.active ? `${employee.name} can no longer sign in.` : `${employee.name} can sign in again.`,
                  )}
                  className={login.active ? 'btn-danger' : 'btn-secondary'}
                >
                  {login.active ? 'Switch off login' : 'Switch login back on'}
                </button>
              )}
            </div>
          </div>
        )}

        {mode !== 'view' && (
          <form onSubmit={submit} className="grid gap-4 sm:max-w-md">
            {mode === 'create' && (
              <Field label="Email" hint="What they type to sign in. It need not match the email on their profile." required>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" autoComplete="off" />
              </Field>
            )}
            <Field label={mode === 'create' ? 'Password' : 'New password'} hint={`At least ${MIN_PASSWORD} characters.`} required>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="new-password" />
            </Field>
            <Field label="Confirm password" required>
              <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" autoComplete="new-password" />
            </Field>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
                {busy ? 'Saving…' : mode === 'create' ? 'Create login' : 'Set password'}
              </button>
              <button type="button" onClick={() => { setMode('view'); setError(null) }} className="btn-secondary">Cancel</button>
            </div>
          </form>
        )}

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </Section>
  )
}
