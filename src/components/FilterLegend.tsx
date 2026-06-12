import { useMemo } from 'react'
import { useAppStore } from '../state/store'
import { CATEGORY_ORDER } from '../lib/groups'

export function FilterLegend() {
  const catalog = useAppStore((s) => s.catalog)
  const enabledCategories = useAppStore((s) => s.enabledCategories)
  const toggleCategory = useAppStore((s) => s.toggleCategory)

  const counts = useMemo(() => {
    const c = new Array<number>(CATEGORY_ORDER.length).fill(0)
    if (catalog) {
      for (let i = 0; i < catalog.count; i++) c[catalog.categories[i]]++
    }
    return c
  }, [catalog])

  const visibleTotal = useMemo(
    () => counts.reduce((acc, n, i) => acc + (enabledCategories[i] ? n : 0), 0),
    [counts, enabledCategories],
  )

  return (
    <div className="filter-legend" data-testid="filter-legend">
      <div className="legend-header">
        <span>分類フィルタ</span>
        <span className="visible-count" data-testid="visible-count">
          {visibleTotal.toLocaleString()} 機表示
        </span>
      </div>
      <ul>
        {CATEGORY_ORDER.map((cat, i) => (
          <li key={cat.id}>
            <label className="legend-item">
              <input
                type="checkbox"
                checked={enabledCategories[i]}
                data-testid={`filter-${cat.id}`}
                onChange={() => toggleCategory(i)}
              />
              <span className="cat-dot" style={{ background: cat.color }} />
              <span className="legend-label">{cat.label}</span>
              <span className="legend-count">{counts[i].toLocaleString()}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
