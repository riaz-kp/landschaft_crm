import { useSyncExternalStore } from 'react'
import { store, type DbShape } from '../data/store'

/** Subscribes a component to the data store. */
export function useDb(): DbShape {
  return useSyncExternalStore(store.subscribe, store.getSnapshot).db
}
