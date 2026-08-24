import { getEightySixSnapshot } from '../queries'
import { EightySixSnapshotCard } from './EightySixSnapshotCard'

export async function EightySixSnapshotCardServer({
  weekStart,
  location,
}: {
  weekStart: string
  location: string
}) {
  const data = await getEightySixSnapshot({ weekStart, location })
  return <EightySixSnapshotCard data={data} />
}