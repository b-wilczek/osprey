import { getLaborTrend } from '../queries'
import { LaborSnapshotCard } from './LaborSnapshotCard'

export async function LaborSnapshotCardServer({
  weekStart,
  location,
}: {
  weekStart: string
  location: string
}) {
  const trend = await getLaborTrend({ weekStart, location })
  return <LaborSnapshotCard trend={trend} />
}