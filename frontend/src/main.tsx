import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { SessionProvider } from './state/session'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UpdatePrompt } from './components/UpdatePrompt'
import { registerServiceWorker } from './lib/pwa'
import { App } from './App'
import './styles.css'

const Portal = lazy(() => import('./pages/portal/Portal').then((m) => ({ default: m.Portal })))

/** Client links (/portal/…) open without signing in; everything else is the CRM behind its login. */
function Root() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/portal/')) return <Suspense fallback={null}><Portal /></Suspense>
  return (
    <SessionProvider>
      <App />
    </SessionProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Root />
      </BrowserRouter>
      <UpdatePrompt />
    </ErrorBoundary>
  </StrictMode>,
)

registerServiceWorker()
