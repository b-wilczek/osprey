// The single place that decides what appears in the header menu.
// Add, remove, or reorder entries here — nothing else needs to change.

export interface NavLinkEntry {
  type: 'link'
  label: string
  href: string
}

export interface NavDropdownEntry {
  type: 'dropdown'
  label: string
  items: { label: string; href: string }[]
}

export type NavEntry = NavLinkEntry | NavDropdownEntry

export const NAV_ENTRIES: NavEntry[] = [
  { type: 'link', label: 'Dashboard', href: '/' },
  {
    type: 'dropdown',
    label: 'Other Tools',
    items: [
      { label: 'Import Data', href: '/import' },
      { label: 'LOG Inventory', href: '/log_inventory' },
    ],
  },
]

/**
 * True when `href` is the current page, or a parent of it
 * (so /import/history still highlights "Import Data").
 * "/" only matches itself — otherwise Dashboard would light up everywhere.
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}