import type { SatSource, CategoryId } from '../types'
import { GROUPS, tleUrl } from './groups'

export const CACHE_MAX_AGE_MS = 2 * 60 * 60 * 1000 // 2 h — CelesTrak rate-limits aggressive clients
const CACHE_PREFIX = 'tle-cache-v1:'

export interface FetchResult {
  sats: SatSource[]
  /** oldest fetch timestamp among the groups actually used */
  fetchedAt: number
  /** true when at least one group came from a stale cache after a failed fetch */
  usedStaleCache: boolean
  /** groups that produced no data at all (fetch failed, no cache) */
  failedGroups: string[]
}

/** Parse a 3LE text block (name + line1 + line2 repeated) into records. */
export function parseTle(text: string, category: CategoryId): SatSource[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)
  const out: SatSource[] = []
  for (let i = 0; i + 2 < lines.length + 1; ) {
    const name = lines[i]
    const line1 = lines[i + 1]
    const line2 = lines[i + 2]
    if (!line1 || !line2 || !line1.startsWith('1 ') || !line2.startsWith('2 ')) {
      i += 1
      continue
    }
    const noradId = Number.parseInt(line1.slice(2, 7), 10)
    if (Number.isFinite(noradId)) {
      out.push({ name: name.trim(), noradId, line1, line2, category })
    }
    i += 3
  }
  return out
}

/** Dedupe by NORAD ID; earlier entries win (GROUPS is in priority order). */
export function dedupeByNoradId(sats: SatSource[]): SatSource[] {
  const seen = new Set<number>()
  const out: SatSource[] = []
  for (const sat of sats) {
    if (!seen.has(sat.noradId)) {
      seen.add(sat.noradId)
      out.push(sat)
    }
  }
  return out
}

interface CacheEntry {
  fetchedAt: number
  text: string
}

function readCache(storage: Storage, group: string): CacheEntry | null {
  try {
    const raw = storage.getItem(CACHE_PREFIX + group)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry
    if (typeof parsed.fetchedAt !== 'number' || typeof parsed.text !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(storage: Storage, group: string, entry: CacheEntry): void {
  try {
    storage.setItem(CACHE_PREFIX + group, JSON.stringify(entry))
  } catch {
    // Quota exceeded — drop silently; next load just refetches.
  }
}

export function isFresh(entry: CacheEntry, now: number, maxAgeMs = CACHE_MAX_AGE_MS): boolean {
  return now - entry.fetchedAt < maxAgeMs
}

async function fetchGroupText(
  group: string,
  storage: Storage,
  now: number,
): Promise<{ entry: CacheEntry; stale: boolean }> {
  const cached = readCache(storage, group)
  if (cached && isFresh(cached, now)) {
    return { entry: cached, stale: false }
  }
  try {
    const res = await fetch(tleUrl(group))
    if (!res.ok) throw new Error(`CelesTrak ${group}: HTTP ${res.status}`)
    const text = await res.text()
    if (!text.includes('\n1 ')) throw new Error(`CelesTrak ${group}: unexpected payload`)
    const entry = { fetchedAt: now, text }
    writeCache(storage, group, entry)
    return { entry, stale: false }
  } catch (err) {
    if (cached) {
      return { entry: cached, stale: true } // stale cache beats no data
    }
    throw err
  }
}

/**
 * Fetch all groups (cache-first), parse, and dedupe.
 * onProgress reports completed group count for the loading overlay.
 */
export async function fetchAllTles(
  storage: Storage = localStorage,
  now: number = Date.now(),
  onProgress?: (done: number, total: number) => void,
): Promise<FetchResult> {
  let done = 0
  const results = await Promise.all(
    GROUPS.map(async ({ group, category }) => {
      try {
        const r = await fetchGroupText(group, storage, now)
        return { ...r, category, group, failed: false as const }
      } catch (err) {
        // One broken group must not take the whole app down.
        console.warn(`TLE group ${group} unavailable:`, err)
        return {
          entry: { fetchedAt: now, text: '' },
          stale: false,
          category,
          group,
          failed: true as const,
        }
      } finally {
        done += 1
        onProgress?.(done, GROUPS.length)
      }
    }),
  )
  const all: SatSource[] = []
  let fetchedAt = now
  let usedStaleCache = false
  const failedGroups: string[] = []
  for (const r of results) {
    if (r.failed) {
      failedGroups.push(r.group)
      continue
    }
    all.push(...parseTle(r.entry.text, r.category))
    fetchedAt = Math.min(fetchedAt, r.entry.fetchedAt)
    usedStaleCache ||= r.stale
  }
  if (failedGroups.length === GROUPS.length) {
    throw new Error('全ての衛星データ取得に失敗しました (CelesTrak unreachable)')
  }
  const sats = dedupeByNoradId(all)
  if (sats.length === 0) {
    throw new Error('衛星データが空でした')
  }
  return { sats, fetchedAt, usedStaleCache, failedGroups }
}
