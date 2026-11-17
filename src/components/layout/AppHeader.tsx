import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AuthButton } from './AuthButton'
import { NavMenu } from '@/components/nav/NavMenu'
import { MobileNav } from '@/components/nav/MobileNav'

export async function AppHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoggedIn = !!user

  return (
    // `relative` anchors MobileNav's full-width drop-down panel.
    <header className="relative flex items-center gap-4 border-b border-[#ddd] px-6 py-3 md:gap-8">
      {/* Logged out (e.g. the public waste/86 form), "/" would just bounce to
          /login, so the name is only a link when signed in. */}
      {isLoggedIn ? (
        <Link href="/" className="font-bold">
          Osprey
        </Link>
      ) : (
        <strong>Osprey</strong>
      )}

      {/* Section links only for signed-in users — every page they point to
          requires login. Desktop/tablet: inline bar. */}
      {isLoggedIn && (
        <div className="hidden md:block">
          <NavMenu />
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <AuthButton isLoggedIn={isLoggedIn} />
        {/* Phones: hamburger (hides itself at md and up) */}
        {isLoggedIn && <MobileNav />}
      </div>
    </header>
  )
}