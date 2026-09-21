import { getRevenueTrend } from '../queries'
import { RevenueSnapshotCard } from './RevenueSnapshotCard'

export async function RevenueSnapshotCardServer({
  weekStart,
  location,
}: {
  weekStart: string
  location: string
}) {
  const trend = await getRevenueTrend({ weekStart, location })
  return <RevenueSnapshotCard trend={trend} />
}