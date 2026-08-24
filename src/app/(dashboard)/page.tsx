import { Suspense } from 'react'
import { getWasteLocations } from '@/features/dashboard/queries'
import { DashboardControls } from '@/features/dashboard/components/DashboardControls'
import { EightySixSnapshotCardServer } from '@/features/dashboard/components/EightySixSnapshotCardServer'
import { WasteSnapshotCardServer } from '@/features/dashboard/components/WasteSnapshotCardServer'
import { LaborSnapshotCardServer } from '@/features/dashboard/components/LaborSnapshotCardServer'
import { RevenueSnapshotCardServer } from '@/features/dashboard/components/RevenueSnapshotCardServer'
import { EfficiencySnapshotCardServer } from '@/features/dashboard/components/EfficiencySnapshotCardServer'
import { WasteCardServer } from '@/features/dashboard/components/WasteCardServer'
import { parseWeekParam } from '@/lib/weeks'

export const dynamic = 'force-dynamic'

type SearchParams = { [key: string]: string | string[] | undefined }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const weekStart = parseWeekParam(params.week)

  const locations = await getWasteLocations()
  const location =
    (typeof params.location === 'string' && locations.includes(params.location)
      ? params.location
      : locations[0]) ?? ''

  return (
    <main className="p-10">
      <h1 className="mb-6 text-2xl font-bold">Manager Dashboard</h1>

      <DashboardControls weekStart={weekStart} location={location} locations={locations} />

      <div className="grid gap-6">
        {location ? (
          <>
            <Suspense fallback={<p>Loading 86 snapshot...</p>}>
              <EightySixSnapshotCardServer weekStart={weekStart} location={location} />
            </Suspense>

            <Suspense fallback={<p>Loading waste snapshot...</p>}>
              <WasteSnapshotCardServer weekStart={weekStart} location={location} />
            </Suspense>

            <Suspense fallback={<p>Loading labor snapshot...</p>}>
              <LaborSnapshotCardServer weekStart={weekStart} location={location} />
            </Suspense>

            <Suspense fallback={<p>Loading revenue snapshot...</p>}>
              <RevenueSnapshotCardServer weekStart={weekStart} location={location} />
            </Suspense>

            <Suspense fallback={<p>Loading efficiency snapshot...</p>}>
              <EfficiencySnapshotCardServer weekStart={weekStart} location={location} />
            </Suspense>
          </>
        ) : (
          <p className="text-sm text-gray-500">No locations found in waste_locations.</p>
        )}

        {/* Existing date-range Waste card — untouched, still has its own
            From/To/Location filters. */}
        <Suspense fallback={<p>Loading waste data...</p>}>
          <WasteCardServer searchParams={params} />
        </Suspense>
      </div>
    </main>
  )
}