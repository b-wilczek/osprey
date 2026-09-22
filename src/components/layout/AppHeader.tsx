import { createClient } from '@/lib/supabase/server'
import { AuthButton } from './AuthButton'

export async function AppHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        borderBottom: '1px solid #ddd',
      }}
    >
      <nav style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <strong>Osprey</strong>
        {/* future section links go here */}
      </nav>
      <AuthButton isLoggedIn={!!user} />
    </header>
  )
}