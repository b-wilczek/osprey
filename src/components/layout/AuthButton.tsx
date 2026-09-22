'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/login/actions'

export function AuthButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname()

  if (isLoggedIn) {
    return (
      <form action={logout}>
        <button type="submit">Log out</button>
      </form>
    )
  }

  if (pathname.startsWith('/login')) return null

  return <Link href="/login">Log in</Link>
}