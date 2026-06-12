import { useMemo } from 'react'
import { useAppStore } from '../state/store'
import { renderBuffers } from '../scene/sharedBuffers'
import { flyToSatellite } from '../scene/cameraBus'

const MAX_RESULTS = 20

export function SearchBox() {
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const catalog = useAppStore((s) => s.catalog)
  const select = useAppStore((s) => s.select)

  const results = useMemo(() => {
    if (!catalog || searchQuery.trim().length < 2) return []
    const q = searchQuery.trim().toUpperCase()
    const out: { index: number; name: string }[] = []
    for (let i = 0; i < catalog.count && out.length < MAX_RESULTS; i++) {
      if (catalog.names[i].toUpperCase().includes(q)) {
        out.push({ index: i, name: catalog.names[i] })
      }
    }
    return out
  }, [catalog, searchQuery])

  const onPick = (index: number) => {
    select(index)
    setSearchQuery('')
    const pos = renderBuffers.positions
    if (pos && index < renderBuffers.count) {
      flyToSatellite([pos[index * 3], pos[index * 3 + 1], pos[index * 3 + 2]])
    }
  }

  return (
    <div className="search-box">
      <input
        type="search"
        className="search-input"
        placeholder="衛星名で検索 (例: ISS, HUBBLE)"
        value={searchQuery}
        data-testid="search-input"
        onChange={(e) => setSearchQuery(e.target.value)}
        disabled={!catalog}
      />
      {results.length > 0 && (
        <ul className="search-results" data-testid="search-results">
          {results.map((r) => (
            <li key={r.index}>
              <button className="search-result" onClick={() => onPick(r.index)}>
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
