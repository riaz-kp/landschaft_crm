// Web Push, the standard every browser's push service speaks (Chrome and
// Android through Google, Firefox through Mozilla, Safari and iPhone home-screen
// apps through Apple). A message is encrypted for one device (RFC 8291,
// aes128gcm) and signed with the CRM's own key pair (VAPID, RFC 8292), so a
// push service delivers it only from us and cannot read it.
//
// Plain WebCrypto, so it runs the same in Supabase's Deno and in Node (tests).

export interface Subscription {
  endpoint: string
  /** The device's public key, base64url. */
  p256dh: string
  /** The device's auth secret, base64url. */
  auth: string
}

export interface VapidKeys {
  /** Uncompressed P-256 public key (65 bytes), base64url. This is what browsers subscribe with. */
  publicKey: string
  /** The private scalar `d` (32 bytes), base64url. */
  privateKey: string
}

const encoder = new TextEncoder()
const subtle = crypto.subtle

export function toBase64Url(bytes: Uint8Array): string {
  let text = ''
  for (const b of bytes) text += String.fromCharCode(b)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(text: string): Uint8Array {
  const plain = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = plain + '='.repeat((4 - (plain.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await subtle.sign('HMAC', k, data))
}

/** A fresh key pair for the CRM. Made once, on the server, and kept in Vault. */
export async function generateVapidKeys(): Promise<VapidKeys> {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair
  const jwk = await subtle.exportKey('jwk', pair.privateKey)
  const publicKey = new Uint8Array(await subtle.exportKey('raw', pair.publicKey))
  return { publicKey: toBase64Url(publicKey), privateKey: jwk.d! }
}

/** Encrypts one message for one device: the aes128gcm body a push service forwards as it is. */
export async function encryptFor(subscription: Subscription, payload: Uint8Array): Promise<Uint8Array> {
  const uaPublic = fromBase64Url(subscription.p256dh)
  const authSecret = fromBase64Url(subscription.auth)
  const uaKey = await subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const local = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
  const asPublic = new Uint8Array(await subtle.exportKey('raw', local.publicKey))
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256))

  const one = new Uint8Array([1])
  const ikm = await hmac(
    await hmac(authSecret, shared),
    concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic, one),
  )
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, concat(encoder.encode('Content-Encoding: aes128gcm\0'), one))).slice(0, 16)
  const nonce = (await hmac(prk, concat(encoder.encode('Content-Encoding: nonce\0'), one))).slice(0, 12)

  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // One record: the message, then the 0x02 that marks the last record.
  const cipher = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))))

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, cipher)
}

/** The Authorization header that proves the message comes from the holder of the CRM's key. */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, subject: string): Promise<string> {
  const pub = fromBase64Url(keys.publicKey)
  const key = await subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: toBase64Url(pub.slice(1, 33)), y: toBase64Url(pub.slice(33, 65)), d: keys.privateKey, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const part = (value: unknown) => toBase64Url(encoder.encode(JSON.stringify(value)))
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  })}`
  const signature = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned)))
  return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${keys.publicKey}`
}

export interface PushResult {
  status: number
  /** The push service no longer knows this device: it unsubscribed, or the app was removed. */
  gone: boolean
  detail?: string
}

/** Sends one message to one device. */
export async function sendPush(
  subscription: Subscription,
  message: string,
  keys: VapidKeys,
  options: { subject: string; ttlSeconds?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high' },
): Promise<PushResult> {
  const body = await encryptFor(subscription, encoder.encode(message))
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, keys, options.subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(options.ttlSeconds ?? 12 * 3600),
      Urgency: options.urgency ?? 'high',
    },
    body,
  })
  const detail = response.ok ? undefined : (await response.text().catch(() => '')).slice(0, 300)
  if (response.ok) await response.body?.cancel()
  return { status: response.status, gone: response.status === 404 || response.status === 410, detail }
}
