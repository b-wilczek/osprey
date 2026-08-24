import { getEfficiencySnapshot } from '../queries'
import { EfficiencySnapshotCard } from './EfficiencySnapshotCard'

export async function EfficiencySnapshotCardServer({
  weekStart,
  location,
}: {
  weekStart: string
  location: string
}) {
  const data = await getEfficiencySnapshot({ weekStart, location })
  return <EfficiencySnapshotCard data={data} />
}