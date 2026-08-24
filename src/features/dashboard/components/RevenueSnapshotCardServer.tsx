import { getRevenueSnapshot } from '../queries'
import { RevenueSnapshotCard } from './RevenueSnapshotCard'

export async function RevenueSnapshotCardServer({
  weekStart,
  location,
}: {
  weekStart: string
  location: string
}) {
  const totalSales = await getRevenueSnapshot({ weekStart, location })
  return <RevenueSnapshotCard totalSales={totalSales} />
}