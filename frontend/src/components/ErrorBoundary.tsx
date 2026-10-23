import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * Catches a screen that crashes, so one bad record shows a way back instead of
 * a blank page. Changes already made are safe: they were saved as they happened.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-card">
          <h1 className="font-display text-lg font-bold text-stone-900">Something went wrong on this screen</h1>
          <p className="mt-2 text-sm text-stone-500">
            Your saved work is safe. Reload to carry on; if it happens again, tell your admin what you were doing.
          </p>
          <p className="mt-3 break-words rounded-lg bg-stone-50 px-3 py-2 text-left font-mono text-xs text-stone-500">{this.state.error.message}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={() => window.location.reload()} className="btn-primary">Reload</button>
            <button onClick={() => { window.location.href = '/' }} className="btn-secondary">Go to start</button>
          </div>
        </div>
      </div>
    )
  }
}
