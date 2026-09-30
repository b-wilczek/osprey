'use client'

import { Card } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/StatTile'
import { formatCurrency } from '@/lib/format'
import type { LaborTrendPoint } from '../types'

interface LaborSnapshotCardProps {
  trend: LaborTrendPoint[] // 5 points, oldest to newest; last = current week
}

function PreviousWeeks({ weeks }: { weeks: LaborTrendPoint[] }) {
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
            <td className="pr-4 text-gray-500">Hours</td>
            {weeks.map((point) => (
              <td key={point.weekStart} className="px-3 text-right text-gray-600">
                {point.totalHours.toFixed(1)}
              </td>
            ))}
          </tr>
          <tr>
            <td className="pr-4 text-gray-500">Cost</td>
            {weeks.map((point) => (
              <td key={point.weekStart} className="px-3 text-right text-gray-600">
                {formatCurrency(point.totalCost)}
                {point.hasNullCost ? '*' : ''}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function LaborSnapshotCard({ trend }: LaborSnapshotCardProps) {
  const currentWeek = trend[trend.length - 1]
  const previousWeeks = trend.slice(0, -1).reverse()
  const costValue = `${formatCurrency(currentWeek?.totalCost ?? 0)}${
    currentWeek?.hasNullCost ? '*' : ''
  }`
  return (
    <Card title="Labor Snapshot">
      <div className="flex flex-wrap gap-8">
        <StatTile label="Total Hours" value={`${(currentWeek?.totalHours ?? 0).toFixed(1)} hrs`} />
        <StatTile label="Total Cost" value={costValue} />
      </div>
      {previousWeeks.length > 0 && <PreviousWeeks weeks={previousWeeks} />}
      {currentWeek?.hasNullCost && (
        <p className="mt-2 text-xs text-gray-400">
          * incomplete — some entries are missing a cost
        </p>
      )}
    </Card>
  )
}