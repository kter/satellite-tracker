import { useState, type ReactNode } from 'react'

/** Mobile collapsible panel with a drag handle (tap to toggle). */
export function BottomSheet({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`bottom-sheet ${open ? 'open' : ''}`} data-testid="bottom-sheet">
      <button
        className="sheet-handle"
        aria-label={open ? 'パネルを閉じる' : 'パネルを開く'}
        data-testid="sheet-handle"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="handle-bar" />
      </button>
      <div className="sheet-content">{children}</div>
    </div>
  )
}
