import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { InventoryForm, type Location } from './InventoryForm'

export const metadata: Metadata = {
  title: 'De Fer LOG Inventory',
}

export default async function LogInventoryPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('log_get_locations')
  const locations = (data ?? []) as Location[]

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-6">
      <h1 className="mb-1 text-2xl font-semibold">De Fer LOG Inventory</h1>
      <p className="mb-6 text-sm opacity-70">
        Large Order Good (LOG) Inventory. Please count up the quantity of the main unit of each item (usually cases), and then an approximate quantity of the secondary unit (e.g. sleeves). Use zeroes if you don't have something in stock. Any questions? Slack or email Brandon.
      </p>

      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
          Couldn't load locations. Refresh the page to try again.
        </p>
      ) : (
        <InventoryForm locations={locations} />
      )}
    </main>
  )
}