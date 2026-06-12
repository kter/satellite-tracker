import type { CategoryId } from '../types'

export interface GroupDef {
  /** CelesTrak GROUP query parameter */
  group: string
  category: CategoryId
}

/**
 * CelesTrak groups to fetch, in dedupe-priority order: when a satellite appears
 * in several groups, the first group listed here wins its category.
 */
export const GROUPS: GroupDef[] = [
  { group: 'stations', category: 'stations' },
  { group: 'starlink', category: 'starlink' },
  { group: 'gps-ops', category: 'navigation' },
  { group: 'glo-ops', category: 'navigation' },
  { group: 'galileo', category: 'navigation' },
  { group: 'beidou', category: 'navigation' },
  { group: 'weather', category: 'weather' },
  { group: 'science', category: 'science' },
  { group: 'geo', category: 'geo' },
  { group: 'active', category: 'other' },
]

export interface CategoryDef {
  id: CategoryId
  label: string
  /** hex color used for satellite dots and the legend */
  color: string
}

/** Order matters: index in this array is the byte stored per satellite. */
export const CATEGORY_ORDER: CategoryDef[] = [
  { id: 'stations', label: 'Stations', color: '#ff5d5d' },
  { id: 'starlink', label: 'Starlink', color: '#4da6ff' },
  { id: 'navigation', label: 'Navigation', color: '#ffd166' },
  { id: 'weather', label: 'Weather', color: '#06d6a0' },
  { id: 'science', label: 'Science', color: '#c084fc' },
  { id: 'geo', label: 'Geostationary', color: '#f97316' },
  { id: 'other', label: 'Other active', color: '#8b97a8' },
]

export const CATEGORY_INDEX: Record<CategoryId, number> = Object.fromEntries(
  CATEGORY_ORDER.map((c, i) => [c.id, i]),
) as Record<CategoryId, number>

/**
 * Single source of truth for CelesTrak URLs so E2E tests can intercept them
 * with one route pattern.
 */
export function tleUrl(group: string): string {
  return `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=tle`
}
