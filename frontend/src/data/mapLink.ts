import { DEMO_MODE, isNetworkError, supabase } from '../lib/supabase'

/**
 * Expands a short Google or Apple Maps share link (maps.app.goo.gl/…, maps.apple/p/…) through the
 * `map-link` Edge Function, since a browser cannot follow it itself.
 */
export async function expandMapLink(url: string): Promise<string> {
  if (DEMO_MODE) throw new Error('Short share links need the server. In the demo, paste the full map link from the browser.')
  const { data, error } = await supabase().functions.invoke('map-link', { body: { url } })
  if (!error) return (data as { url: string }).url
  const response = (error as { context?: Response }).context
  if (response && typeof response.json === 'function') {
    const reply = await response.json().catch(() => null) as { error?: string } | null
    if (reply?.error) throw new Error(reply.error)
    if (response.status === 404) {
      throw new Error('Short share links cannot be read yet. Open the link, then copy the full address from the browser bar and paste that.')
    }
  }
  if (isNetworkError(error)) throw new Error('No connection. Try again once you are back online.')
  throw new Error('Could not read that link. Try again in a minute.')
}
