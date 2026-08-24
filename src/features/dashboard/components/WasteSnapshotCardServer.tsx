import { getWasteWeeklySnapshot } from '../queries'
import { WasteSnapshotCard } from './WasteSnapshotCard'

export async function WasteSnapshotCardServer({
  weekStart,
  location,
}: {
  weekStart: string
  location: string
}) {
  const data = await getWasteWeeklySnapshot({ weekStart, location })
  return <WasteSnapshotCard data={data} />
}