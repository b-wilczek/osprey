import { getWasteLocations, getWasteTotals } from '../queries'
import { WasteCard } from './WasteCard'

type SearchParams = { [key: string]: string | string[] | undefined }

function defaultDateRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 6) // last 7 days, inclusive of today

  const toISODate = (d: Date) => d.toISOString().split('T')[0]
  return { start: toISODate(start), end: toISODate(end) }
}

export async function WasteCardServer({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const defaults = defaultDateRange()

  const startDate = (searchParams.wasteStart as string) ?? defaults.start
  const endDate = (searchParams.wasteEnd as string) ?? defaults.end
  const locationParam = (searchParams.wasteLocation as string) ?? 'ALL'

  const [totals, locations] = await Promise.all([
    getWasteTotals({
      startDate,
      endDate,
      location: locationParam === 'ALL' ? null : locationParam,
    }),
    getWasteLocations(),
  ])

  return (
    <WasteCard
      data={totals}
      locations={locations}
      initialStartDate={startDate}
      initialEndDate={endDate}
      initialLocation={locationParam}
    />
  )
}