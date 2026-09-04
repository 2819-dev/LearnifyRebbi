import { useEffect, useId, useState } from 'react'

export type AccountMenuItem = {
  id: string
  label: string
  onClick: () => void
  tone?: 'default' | 'quiet'
}

type Props = {
  greeting?: string | null
  items: AccountMenuItem[]
}

export function AccountMenu({ greeting, items }: Props) {
  const [open, setOpen] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (items.length === 0 && !greeting) return null

  return (
    <>
      <div className="home-nav account-nav">
        {greeting ? <span className="soft account-greeting">{greeting}</span> : <span />}
        <button
          type="button"
          className={`menu-toggle${open ? ' open' : ''}`}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls={titleId}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {open && (
        <div className="account-drawer-root">
          <button
            type="button"
            className="account-drawer-backdrop"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside
            className="account-drawer"
            id={titleId}
            role="dialog"
            aria-modal="true"
            aria-label="Account menu"
          >
            <div className="account-drawer-head">
              <p className="account-drawer-title">Menu</p>
              <button
                type="button"
                className="linkish tiny"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            {greeting && <p className="soft account-drawer-greeting">{greeting}</p>}
            <nav className="account-drawer-nav" aria-label="Account">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`account-drawer-link${item.tone === 'quiet' ? ' quiet' : ''}`}
                  onClick={() => {
                    setOpen(false)
                    item.onClick()
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  )
}
