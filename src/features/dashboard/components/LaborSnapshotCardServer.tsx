import { getLaborSnapshot } from '../queries'
import { LaborSnapshotCard } from './LaborSnapshotCard'

export async function LaborSnapshotCardServer({
  weekStart,
  location,
}: {
  weekStart: string
  location: string
}) {
  const data = await getLaborSnapshot({ weekStart, location })
  return <LaborSnapshotCard data={data} />
}