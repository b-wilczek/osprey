import { updatePassword } from './actions'

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { error, success } = await searchParams

  return (
    <main style={{ padding: 40, maxWidth: 360 }}>
      <h1>Set your password</h1>
      <form action={updatePassword}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="password">New password</label>
          <input id="password" name="password" type="password" required
            minLength={8} style={{ display: 'block', width: '100%' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="confirm">Confirm password</label>
          <input id="confirm" name="confirm" type="password" required
            minLength={8} style={{ display: 'block', width: '100%' }} />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {success && <p style={{ color: 'green' }}>Password updated.</p>}
        <button type="submit">Save password</button>
      </form>
    </main>
  )
}