import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TimeControls } from './TimeControls'
import { FilterLegend } from './FilterLegend'
import { InfoPanel } from './InfoPanel'
import { SearchBox } from './SearchBox'
import { LoadingOverlay } from './LoadingOverlay'
import { useAppStore } from '../state/store'
import { CATEGORY_ORDER, CATEGORY_INDEX } from '../lib/groups'
import { packMeta } from '../lib/satMeta'
import type { SatCatalog } from '../types'

function makeCatalog(): SatCatalog {
  const names = ['ISS (ZARYA)', 'STARLINK-1007', 'STARLINK-1008', 'HST']
  const categories = new Uint8Array([
    CATEGORY_INDEX.stations,
    CATEGORY_INDEX.starlink,
    CATEGORY_INDEX.starlink,
    CATEGORY_INDEX.science,
  ])
  return {
    count: names.length,
    names,
    noradIds: new Int32Array([25544, 44713, 44714, 20580]),
    categories,
    meta: packMeta(
      names.map(() => ({
        inclinationDeg: 51.64,
        periodMin: 92.9,
        apogeeKm: 422,
        perigeeKm: 413,
      })),
    ),
  }
}

beforeEach(() => {
  useAppStore.setState({
    catalog: makeCatalog(),
    loadState: 'ready',
    selectedIndex: null,
    enabledCategories: CATEGORY_ORDER.map(() => true),
    searchQuery: '',
    cameraMode: 'free',
    toast: null,
  })
})

afterEach(cleanup)

describe('TimeControls', () => {
  it('shows a UTC clock and speed buttons', () => {
    render(<TimeControls />)
    expect(screen.getByTestId('sim-clock').textContent).toMatch(/UTC$/)
    for (const m of [1, 10, 60, 600]) {
      expect(screen.getByTestId(`btn-speed-${m}`)).toBeTruthy()
    }
  })

  it('changes the multiplier on click', () => {
    render(<TimeControls />)
    fireEvent.click(screen.getByTestId('btn-speed-600'))
    expect(useAppStore.getState().clock.multiplier).toBe(600)
    expect(screen.getByTestId('btn-speed-600').className).toContain('btn-active')
  })

  it('toggles pause', () => {
    render(<TimeControls />)
    fireEvent.click(screen.getByTestId('btn-pause'))
    expect(useAppStore.getState().clock.paused).toBe(true)
    fireEvent.click(screen.getByTestId('btn-pause'))
    expect(useAppStore.getState().clock.paused).toBe(false)
  })
})

describe('FilterLegend', () => {
  it('renders every category with its count', () => {
    render(<FilterLegend />)
    for (const cat of CATEGORY_ORDER) {
      expect(screen.getByTestId(`filter-${cat.id}`)).toBeTruthy()
    }
    expect(screen.getByTestId('visible-count').textContent).toContain('4')
  })

  it('updates the visible count when a category is disabled', () => {
    render(<FilterLegend />)
    fireEvent.click(screen.getByTestId('filter-starlink'))
    expect(useAppStore.getState().enabledCategories[CATEGORY_INDEX.starlink]).toBe(false)
    expect(screen.getByTestId('visible-count').textContent).toContain('2')
  })
})

describe('InfoPanel', () => {
  it('renders nothing without a selection', () => {
    render(<InfoPanel />)
    expect(screen.queryByTestId('info-panel')).toBeNull()
  })

  it('shows name, NORAD ID, and orbit meta for the selected satellite', () => {
    useAppStore.setState({ selectedIndex: 0 })
    render(<InfoPanel />)
    expect(screen.getByTestId('sat-name').textContent).toBe('ISS (ZARYA)')
    expect(screen.getByTestId('sat-norad').textContent).toBe('25544')
    expect(screen.getByTestId('sat-inclination').textContent).toContain('51.6')
    expect(screen.getByTestId('sat-period').textContent).toContain('92.9')
  })

  it('clears the selection from the close button', () => {
    useAppStore.setState({ selectedIndex: 0 })
    render(<InfoPanel />)
    fireEvent.click(screen.getByTestId('btn-close-info'))
    expect(useAppStore.getState().selectedIndex).toBeNull()
  })
})

describe('SearchBox', () => {
  it('lists matches for a query', () => {
    render(<SearchBox />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'starlink' } })
    const results = screen.getByTestId('search-results')
    expect(results.querySelectorAll('li')).toHaveLength(2)
  })

  it('requires at least 2 characters', () => {
    render(<SearchBox />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'i' } })
    expect(screen.queryByTestId('search-results')).toBeNull()
  })

  it('selects the satellite and clears the query on pick', () => {
    render(<SearchBox />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'ISS' } })
    fireEvent.click(screen.getByText('ISS (ZARYA)'))
    expect(useAppStore.getState().selectedIndex).toBe(0)
    expect(useAppStore.getState().searchQuery).toBe('')
  })
})

describe('LoadingOverlay', () => {
  it('shows progress while loading', () => {
    useAppStore.setState({ loadState: 'loading', loadProgress: { done: 3, total: 10 } })
    render(<LoadingOverlay />)
    expect(screen.getByTestId('loading-overlay')).toBeTruthy()
  })

  it('shows the error card on failure', () => {
    useAppStore.setState({ loadState: 'error', loadError: 'HTTP 403' })
    render(<LoadingOverlay />)
    expect(screen.getByTestId('load-error').textContent).toContain('HTTP 403')
  })

  it('disappears when ready', () => {
    render(<LoadingOverlay />)
    expect(screen.queryByTestId('loading-overlay')).toBeNull()
  })
})
