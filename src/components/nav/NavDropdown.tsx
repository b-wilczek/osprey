'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { isActivePath, type NavDropdownEntry } from './navConfig'
import { ChevronIcon } from './ChevronIcon'

interface NavDropdownProps {
  entry: NavDropdownEntry
  pathname: string
}

export function NavDropdown({ entry, pathname }: NavDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  // Highlight the dropdown's own button when you're on one of its pages.
  const hasActiveChild = entry.items.some((item) => isActivePath(pathname, item.href))

  // While open: close on a click outside, on Escape, or when keyboard focus
  // moves somewhere outside the dropdown (e.g. tabbing past the last item).
  useEffect(() => {
    if (!open) return

    const isOutside = (target: EventTarget | null) =>
      !containerRef.current?.contains(target as Node)

    const onPointerDown = (e: PointerEvent) => {
      if (isOutside(e.target)) setOpen(false)
    }
    const onFocusIn = (e: FocusEvent) => {
      if (isOutside(e.target)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={menuId}
        className={`flex items-center gap-1 rounded px-3 py-2 text-sm font-medium transition-colors ${
          hasActiveChild || open
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
      >
        {entry.label}
        <ChevronIcon open={open} />
      </button>

      {open && (
        <ul
          id={menuId}
          className="absolute left-0 top-full z-50 mt-1 min-w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {entry.items.map((item) => {
            const active = isActivePath(pathname, item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`block px-4 py-2 text-sm ${
                    active
                      ? 'bg-gray-100 font-medium text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}