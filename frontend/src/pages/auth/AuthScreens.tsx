import { useState, type FormEvent, type ReactNode } from 'react'
import { staffAccounts, supabase } from '../../lib/supabase'
import { LogoLockup, LogoMark } from '../../components/Logo'
import { Field } from '../../components/ui'
import { Icon } from '../../components/Icon'

const MIN_PASSWORD = 8

/** The frame every sign-in screen sits in: the brand on dark green, the form on a card. */
function AuthFrame({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-900 via-brand-950 to-brand-950 px-4 py-10">
      <div className="mb-8"><LogoLockup /></div>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
        <h1 className="font-display text-lg font-bold text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> {message}
    </p>
  )
}

function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={busy} className="btn-primary w-full justify-center py-2.5 disabled:opacity-60">
      {busy ? 'Please wait…' : children}
    </button>
  )
}

/** Turns Supabase Auth's wording into something a site foreman can act on. */
function authMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That email and password do not match. Check both and try again.'
  if (/banned/i.test(message)) return 'This login has been switched off. Ask an admin to turn it back on.'
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.'
  if (/fetch|network/i.test(message)) return 'Could not reach the server. Check the connection and try again.'
  return message
}

// ---------------------------------------------------------------- sign in

export function SignIn() {
  const [mode, setMode] = useState<'sign-in' | 'forgot' | 'sent'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: failure } = await supabase().auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (failure) setError(authMessage(failure.message))
  }

  const sendReset = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: failure } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
    setBusy(false)
    if (failure) setError(authMessage(failure.message))
    else setMode('sent')
  }

  if (mode === 'sent') {
    return (
      <AuthFrame title="Check your email" subtitle={<>If <strong>{email.trim()}</strong> has a login, a link to set a new password is on its way.</>}>
        <button onClick={() => setMode('sign-in')} className="btn-secondary w-full justify-center">Back to sign in</button>
      </AuthFrame>
    )
  }

  if (mode === 'forgot') {
    return (
      <AuthFrame title="Reset your password" subtitle="We'll email you a link to choose a new one. An admin can also set it for you from your employee profile.">
        <form onSubmit={sendReset} className="space-y-4">
          <Field label="Email">
            <input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </Field>
          <ErrorLine message={error} />
          <Submit busy={busy}>Send reset link</Submit>
          <button type="button" onClick={() => { setMode('sign-in'); setError(null) }} className="w-full text-center text-sm font-semibold text-brand-700">
            Back to sign in
          </button>
        </form>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame title="Sign in" subtitle="Use the email and password your admin gave you.">
      <form onSubmit={signIn} className="space-y-4">
        <Field label="Email">
          <input type="email" required autoFocus autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </Field>
        <Field label="Password">
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        </Field>
        <ErrorLine message={error} />
        <Submit busy={busy}>Sign in</Submit>
        <button type="button" onClick={() => { setMode('forgot'); setError(null) }} className="w-full text-center text-sm font-semibold text-brand-700">
          Forgot password?
        </button>
      </form>
    </AuthFrame>
  )
}

// ---------------------------------------------------------------- first admin

/** Shown only while the CRM has no logins at all: creates the first Super Admin. */
export function FirstAdminSetup({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters for the password.`)
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    setError(null)
    try {
      await staffAccounts({ action: 'bootstrap', name: name.trim(), email: email.trim(), password })
      const { error: failure } = await supabase().auth.signInWithPassword({ email: email.trim(), password })
      if (failure) throw new Error(authMessage(failure.message))
      onDone()
    } catch (failure) {
      setError((failure as Error).message)
      setBusy(false)
    }
  }

  return (
    <AuthFrame title="Set up Landschaft CRM" subtitle="Create the first admin account. You'll add everyone else from Employees once you're in.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your name" required>
          <input required autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <Field label="Email" required>
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </Field>
        <Field label="Password" hint={`At least ${MIN_PASSWORD} characters.`} required>
          <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        </Field>
        <Field label="Confirm password" required>
          <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
        </Field>
        <ErrorLine message={error} />
        <Submit busy={busy}>Create admin account</Submit>
      </form>
    </AuthFrame>
  )
}

// ---------------------------------------------------------------- new password

/** Reached from a password-reset email: the link has signed them in, so they choose a new password. */
export function SetNewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters for the password.`)
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    setError(null)
    const { error: failure } = await supabase().auth.updateUser({ password })
    setBusy(false)
    if (failure) setError(authMessage(failure.message))
    else onDone()
  }

  return (
    <AuthFrame title="Choose a new password">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`}>
          <input type="password" required autoFocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        </Field>
        <Field label="Confirm new password">
          <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
        </Field>
        <ErrorLine message={error} />
        <Submit busy={busy}>Save password</Submit>
      </form>
    </AuthFrame>
  )
}

// ---------------------------------------------------------------- status screens

export function Splash({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-brand-900 via-brand-950 to-brand-950">
      <LogoMark className="h-12 w-12 animate-pulse" />
      <p className="text-sm font-medium text-brand-100/80">{message}</p>
    </div>
  )
}

/** Signed in, but not as anyone the CRM knows — no linked employee, or the login is switched off. */
export function NoAccessScreen({ email, onSignOut }: { email?: string; onSignOut: () => void }) {
  return (
    <AuthFrame
      title="No access yet"
      subtitle={<>{email ? <><strong>{email}</strong> is</> : 'This login is'} not linked to an active employee. Ask an admin to give you a login from Employees.</>}
    >
      <button onClick={onSignOut} className="btn-secondary w-full justify-center">Sign out</button>
    </AuthFrame>
  )
}

export function LoadError({ message, onRetry, onSignOut }: { message: string; onRetry: () => void; onSignOut: () => void }) {
  return (
    <AuthFrame title="Couldn't load the CRM" subtitle={message}>
      <div className="flex gap-2">
        <button onClick={onRetry} className="btn-primary flex-1 justify-center">Try again</button>
        <button onClick={onSignOut} className="btn-secondary flex-1 justify-center">Sign out</button>
      </div>
    </AuthFrame>
  )
}

/** A build without Supabase settings and not marked as the demo. */
export function NotConfigured() {
  return (
    <AuthFrame
      title="Not configured"
      subtitle={<>This build has no database settings. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> and build again — or set <code>VITE_DEMO_MODE=true</code> for the offline demo.</>}
    >
      <p className="text-xs text-stone-400">See the README for setup steps.</p>
    </AuthFrame>
  )
}
