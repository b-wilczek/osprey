import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createClient()
  const { count, error } = await supabase
  .from('timesheet_data')
  .select('Unique_ID', { count: 'exact' })

  console.log('Supabase test query result:', { count, error })

  return (
    <main style={{ padding: 40 }}>
      <h1>Connection test</h1>
      {error ? (
        <p>Error: {error.message}</p>
      ) : (
        <p>Timesheet Data row count: {count}</p>
      )}
    </main>
  )
}