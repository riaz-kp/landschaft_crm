import { useSyncExternalStore } from 'react'
import { store, type DbShape } from '../mock/store'

/** Subscribes a component to the mock database. */
export function useDb(): DbShape {
  return useSyncExternalStore(store.subscribe, store.getSnapshot).db
}
