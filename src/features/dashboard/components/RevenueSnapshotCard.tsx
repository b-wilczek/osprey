'use client'

import { Card } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/StatTile'
import { formatCurrency } from '@/lib/format'
import type { RevenueTrendPoint } from '../types'

interface RevenueSnapshotCardProps {
  trend: RevenueTrendPoint[] // 5 points, oldest to newest; last = current week
}

function PreviousWeeks({ weeks }: { weeks: RevenueTrendPoint[] }) {
  return (
    <div className="mt-4">
      <div className="mb-2 text-xs text-gray-500">Previous 4 Weeks</div>
      <table className="text-sm">
        <thead>
          <tr>
            <th className="pr-4 text-left font-normal text-gray-400" />
            {weeks.map((point) => (
              <th
                key={point.weekStart}
                className="px-3 text-right text-xs font-normal text-gray-400"
              >
                {point.weekLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pr-4 text-gray-500">Revenue</td>
            {weeks.map((point) => (
              <td key={point.weekStart} className="px-3 text-right text-gray-600">
                {formatCurrency(point.totalSales)}
              </td>
            ))}
          </tr>
          <tr>
            <td className="pr-4 text-gray-500">Checks</td>
            {weeks.map((point) => (
              <td key={point.weekStart} className="px-3 text-right text-gray-600">
                {point.ticketCount}
              </td>
            ))}
          </tr>
          <tr>
            <td className="pr-4 text-gray-500">Avg</td>
            {weeks.map((point) => (
              <td key={point.weekStart} className="px-3 text-right text-gray-600">
                {point.ticketAvg === null ? '—' : formatCurrency(point.ticketAvg)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function RevenueSnapshotCard({ trend }: RevenueSnapshotCardProps) {
  const currentWeek = trend[trend.length - 1]
  // drop the current week (already shown above), then flip the remaining
  // 4 to newest-first for display — getRevenueTrend itself still returns
  // oldest→newest, this reversal is purely how the card presents it.
  const previousWeeks = trend.slice(0, -1).reverse()

  return (
    <Card title="Revenue Snapshot">
      <div className="flex flex-wrap gap-8">
        <StatTile label="Total Sales" value={formatCurrency(currentWeek?.totalSales ?? 0)} />
        <StatTile label="Total Checks" value={String(currentWeek?.ticketCount ?? 0)} />
        <StatTile
          label="Ticket Avg"
          value={currentWeek?.ticketAvg == null ? '—' : formatCurrency(currentWeek.ticketAvg)}
        />
      </div>
      {previousWeeks.length > 0 && <PreviousWeeks weeks={previousWeeks} />}
    </Card>
  )
}