'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { NAV_ENTRIES, isActivePath } from './navConfig'
import { ChevronIcon } from './ChevronIcon'

// Phone/small-screen menu: a hamburger button that drops a full-width panel
// down from the header. Dropdown entries become expandable sections.
// Hidden at the md breakpoint and up (see AppHeader), where NavMenu takes over.
export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  // The dropdown section that contains the current page, if any.
  const activeSection =
    NAV_ENTRIES.find(
      (e) => e.type === 'dropdown' && e.items.some((i) => isActivePath(pathname, i.href))
    )?.label ?? null

  const toggleMenu = () => {
    // Opening: pre-expand the section you're currently in.
    if (!open) setExpanded(activeSection)
    setOpen(!open)
  }

  const close = () => setOpen(false)

  // While open: close on a tap outside or on Escape.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const linkClass = (active: boolean) =>
    `block rounded px-3 py-3 text-base ${
      active ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-700 hover:bg-gray-50'
    }`

  return (
    // Deliberately NOT `relative` — the panel positions itself against the
    // <header>, so it spans the full screen width.
    <div ref={containerRef} className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="rounded p-2 text-gray-700 hover:bg-gray-50"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
          {open ? (
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {open && (
        <nav
          id={panelId}
          aria-label="Main"
          className="absolute left-0 right-0 top-full z-50 border-b border-gray-200 bg-white shadow-lg"
        >
          <ul className="space-y-1 px-4 py-3">
            {NAV_ENTRIES.map((entry) => {
              if (entry.type === 'link') {
                const active = isActivePath(pathname, entry.href)
                return (
                  <li key={entry.label}>
                    <Link
                      href={entry.href}
                      onClick={close}
                      aria-current={active ? 'page' : undefined}
                      className={linkClass(active)}
                    >
                      {entry.label}
                    </Link>
                  </li>
                )
              }

              const isExpanded = expanded === entry.label
              const sectionId = `${panelId}-${entry.label}`
              return (
                <li key={entry.label}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : entry.label)}
                    aria-expanded={isExpanded}
                    aria-controls={sectionId}
                    className={`flex w-full items-center justify-between rounded px-3 py-3 text-base ${
                      activeSection === entry.label ? 'font-medium text-gray-900' : 'text-gray-700'
                    } hover:bg-gray-50`}
                  >
                    {entry.label}
                    <ChevronIcon open={isExpanded} />
                  </button>
                  {isExpanded && (
                    <ul id={sectionId} className="ml-3 space-y-1 border-l border-gray-200 pl-3">
                      {entry.items.map((item) => {
                        const active = isActivePath(pathname, item.href)
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={close}
                              aria-current={active ? 'page' : undefined}
                              className={linkClass(active)}
                            >
                              {item.label}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </div>
  )
}