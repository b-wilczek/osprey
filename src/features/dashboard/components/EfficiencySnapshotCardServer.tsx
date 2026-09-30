import { getEfficiencyTrend } from '../queries'
import { EfficiencySnapshotCard } from './EfficiencySnapshotCard'

export async function EfficiencySnapshotCardServer({
  weekStart,
  location,
}: {
  weekStart: string
  location: string
}) {
  const trend = await getEfficiencyTrend({ weekStart, location })
  return <EfficiencySnapshotCard trend={trend} />
}
