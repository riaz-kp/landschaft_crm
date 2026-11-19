import { callFunction, DEMO_MODE, supabase } from './supabase'

/**
 * Push notifications on this device: reminders, site visits and consultations
 * in the notification panel of Windows, macOS, Android or an iPhone, the CRM
 * open or not. The browser holds the subscription; the push function
 * (supabase/functions/push) sends to it.
 *
 * iPhone and iPad only allow it in the installed app (Share → Add to Home
 * Screen), never in a Safari tab.
 */

export type PushState =
  /** This browser cannot receive pushes (or this is the offline demo, or a development build). */
  | 'unsupported'
  /** iPhone or iPad in a Safari tab: add the CRM to the Home Screen first. */
  | 'needs-install'
  /** The person blocked notifications for the CRM in the browser's settings. */
  | 'blocked'
  | 'off'
  | 'on'

export function isAppleMobile(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

function supported(): boolean {
  // The service worker runs only in the built app (lib/pwa.ts).
  return import.meta.env.PROD && !DEMO_MODE
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!supported()) return null
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

export async function pushState(): Promise<PushState> {
  if (isAppleMobile() && !isInstalled()) return 'needs-install'
  if (!supported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  return Notification.permission === 'granted' && (await currentSubscription()) ? 'on' : 'off'
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const plain = text.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(plain + '='.repeat((4 - (plain.length % 4)) % 4))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

/** Records this device against the signed-in employee. */
async function save(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON()
  const { error } = await supabase().rpc('push_subscribe', {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent,
  })
  if (error) throw new Error(error.message)
}

/** The key the server signs with; the push function makes it the first time it runs. */
async function serverKey(): Promise<string> {
  const read = async () => {
    const { data, error } = await supabase().rpc('push_public_key')
    if (error) throw new Error(error.message)
    return data as string | null
  }
  const key = await read()
  if (key) return key
  // A brand-new set-up: one test call makes the key, then it is there.
  await callFunction('push', { action: 'test' }).catch(() => undefined)
  const made = await read()
  if (!made) throw new Error('Notifications are not set up on the server yet.')
  return made
}

/**
 * Asks for permission (it must follow a tap — iPhones refuse otherwise),
 * subscribes this device and sends a test notification.
 */
export async function turnOnPush(): Promise<PushState> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  const key = await serverKey()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(key) })
  }
  await save(subscription)
  await sendTestPush()
  return 'on'
}

export async function turnOffPush(): Promise<PushState> {
  const subscription = await currentSubscription()
  if (subscription) {
    await supabase().rpc('push_unsubscribe', { p_endpoint: subscription.endpoint })
    await subscription.unsubscribe()
  }
  return 'off'
}

export async function sendTestPush(): Promise<void> {
  const subscription = await currentSubscription()
  await callFunction('push', { action: 'test', endpoint: subscription?.endpoint })
}

/**
 * On opening the CRM: a device that has notifications on is linked to whoever
 * is signed in now, and a renewed subscription replaces the old one.
 */
export async function refreshPush(): Promise<void> {
  try {
    if (!supported() || Notification.permission !== 'granted') return
    const subscription = await currentSubscription()
    if (subscription) await save(subscription)
  } catch {
    // Offline, or the server is not set up yet: the bell still shows everything.
  }
}

/** On signing out: the next person on this device does not get this person's notifications. */
export async function forgetPushOnThisDevice(): Promise<void> {
  try {
    await turnOffPush()
  } catch {
    // Offline: the browser subscription is still dropped below where possible.
    await (await currentSubscription().catch(() => null))?.unsubscribe().catch(() => undefined)
  }
}
