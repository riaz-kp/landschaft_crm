/**
 * A small key–value store in IndexedDB for what this browser keeps between
 * visits: changes not yet sent, and the copy of the data that opens with no
 * connection. Unlike localStorage it is not capped at a few megabytes, which
 * photos taken offline quickly fill.
 */

const DB_NAME = 'landschaft-crm'
const STORE = 'kv'

let opening: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE)
      request.onsuccess = () => {
        // Closed under us (site data cleared, a newer tab upgrading): open again next time.
        request.result.onclose = () => { opening = null }
        request.result.onversionchange = () => {
          request.result.close()
          opening = null
        }
        resolve(request.result)
      }
      request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'))
      request.onblocked = () => reject(new Error('IndexedDB blocked'))
    })
    opening.catch(() => { opening = null })
  }
  return opening
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = () => reject(tx.error ?? request.error)
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'))
  })
}

export const local = {
  get: <T>(key: string) => run<T | undefined>('readonly', (store) => store.get(key) as IDBRequest<T | undefined>),
  set: (key: string, value: unknown) => run('readwrite', (store) => store.put(value, key)).then(() => undefined),
  delete: (key: string) => run('readwrite', (store) => store.delete(key)).then(() => undefined),
}
