import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 768px)'

function subscribe(callback: () => void): () => void {
  const mql = matchMedia(QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(QUERY).matches,
    () => false,
  )
}
