'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ENTRIES, isActivePath } from './navConfig'
import { NavDropdown } from './NavDropdown'

export function NavMenu() {
  const pathname = usePathname()

  return (
    <nav aria-label="Main">
      <ul className="flex items-center gap-1">
        {NAV_ENTRIES.map((entry) => (
          <li key={entry.label}>
            {entry.type === 'link' ? (
              <Link
                href={entry.href}
                aria-current={isActivePath(pathname, entry.href) ? 'page' : undefined}
                className={`block rounded px-3 py-2 text-sm font-medium transition-colors ${
                  isActivePath(pathname, entry.href)
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {entry.label}
              </Link>
            ) : (
              <NavDropdown entry={entry} pathname={pathname} />
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}