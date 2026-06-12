import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseTle, dedupeByNoradId, fetchAllTles, isFresh, CACHE_MAX_AGE_MS } from './tle'
import { GROUPS } from './groups'

import { ISS_3LE as ISS_TLE, TWO_SATS_3LE as TWO_SATS } from './__fixtures__/tleFixtures'

function makeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  } as Storage
}

describe('parseTle', () => {
  it('parses name + two lines into a record', () => {
    const sats = parseTle(ISS_TLE, 'stations')
    expect(sats).toHaveLength(1)
    expect(sats[0]).toMatchObject({ name: 'ISS (ZARYA)', noradId: 25544, category: 'stations' })
    expect(sats[0].line1.startsWith('1 25544')).toBe(true)
    expect(sats[0].line2.startsWith('2 25544')).toBe(true)
  })

  it('parses multiple records', () => {
    const sats = parseTle(TWO_SATS, 'stations')
    expect(sats.map((s) => s.noradId)).toEqual([25544, 48274])
  })

  it('skips malformed blocks without crashing', () => {
    const sats = parseTle('GARBAGE\nnot a line\nstill not\n' + ISS_TLE, 'stations')
    expect(sats).toHaveLength(1)
    expect(sats[0].noradId).toBe(25544)
  })

  it('returns empty for empty input', () => {
    expect(parseTle('', 'other')).toEqual([])
  })
})

describe('dedupeByNoradId', () => {
  it('keeps the first (higher-priority) occurrence', () => {
    const a = parseTle(ISS_TLE, 'stations')[0]
    const b = { ...a, category: 'other' as const }
    const out = dedupeByNoradId([a, b])
    expect(out).toHaveLength(1)
    expect(out[0].category).toBe('stations')
  })

  it('preserves distinct satellites', () => {
    const sats = parseTle(TWO_SATS, 'stations')
    expect(dedupeByNoradId(sats)).toHaveLength(2)
  })
})

describe('isFresh', () => {
  it('is fresh within the max age and stale after', () => {
    const entry = { fetchedAt: 1000, text: '' }
    expect(isFresh(entry, 1000 + CACHE_MAX_AGE_MS - 1)).toBe(true)
    expect(isFresh(entry, 1000 + CACHE_MAX_AGE_MS)).toBe(false)
  })
})

describe('fetchAllTles', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function mockFetchOk() {
    vi.mocked(fetch).mockImplementation(async () => {
      return new Response(ISS_TLE, { status: 200 })
    })
  }

  it('fetches every group and dedupes across them', async () => {
    mockFetchOk()
    const storage = makeStorage()
    const result = await fetchAllTles(storage, 1_000_000)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(GROUPS.length)
    // same ISS TLE served for all groups → dedupes to a single sat with top priority
    expect(result.sats).toHaveLength(1)
    expect(result.sats[0].category).toBe('stations')
    expect(result.usedStaleCache).toBe(false)
  })

  it('reports progress', async () => {
    mockFetchOk()
    const calls: Array<[number, number]> = []
    await fetchAllTles(makeStorage(), 1_000_000, (d, t) => calls.push([d, t]))
    expect(calls).toHaveLength(GROUPS.length)
    expect(calls.at(-1)).toEqual([GROUPS.length, GROUPS.length])
  })

  it('serves from cache without network when fresh', async () => {
    mockFetchOk()
    const storage = makeStorage()
    await fetchAllTles(storage, 1_000_000)
    vi.mocked(fetch).mockClear()
    const result = await fetchAllTles(storage, 1_000_000 + 60_000)
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    expect(result.sats).toHaveLength(1)
  })

  it('refetches once the cache has expired', async () => {
    mockFetchOk()
    const storage = makeStorage()
    await fetchAllTles(storage, 1_000_000)
    vi.mocked(fetch).mockClear()
    mockFetchOk()
    await fetchAllTles(storage, 1_000_000 + CACHE_MAX_AGE_MS + 1)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(GROUPS.length)
  })

  it('falls back to stale cache when the network fails', async () => {
    mockFetchOk()
    const storage = makeStorage()
    await fetchAllTles(storage, 1_000_000)
    vi.mocked(fetch).mockImplementation(async () => {
      throw new Error('offline')
    })
    const result = await fetchAllTles(storage, 1_000_000 + CACHE_MAX_AGE_MS + 1)
    expect(result.sats).toHaveLength(1)
    expect(result.usedStaleCache).toBe(true)
    expect(result.fetchedAt).toBe(1_000_000)
  })

  it('throws when every group fails and no cache exists', async () => {
    vi.mocked(fetch).mockImplementation(async () => {
      throw new Error('offline')
    })
    await expect(fetchAllTles(makeStorage(), 1_000_000)).rejects.toThrow(/全ての衛星データ/)
  })

  it('survives a single broken group and reports it', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('GROUP=starlink')) return new Response('err', { status: 500 })
      return new Response(ISS_TLE, { status: 200 })
    })
    const result = await fetchAllTles(makeStorage(), 1_000_000)
    expect(result.failedGroups).toEqual(['starlink'])
    expect(result.sats).toHaveLength(1)
  })

  it('rejects non-OK responses (rate limited) and uses cache if present', async () => {
    mockFetchOk()
    const storage = makeStorage()
    await fetchAllTles(storage, 1_000_000)
    vi.mocked(fetch).mockImplementation(async () => new Response('Forbidden', { status: 403 }))
    const result = await fetchAllTles(storage, 1_000_000 + CACHE_MAX_AGE_MS + 1)
    expect(result.usedStaleCache).toBe(true)
  })
})
