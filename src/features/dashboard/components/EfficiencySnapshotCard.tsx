'use client'

import { Card } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/StatTile'
import { formatCurrency } from '@/lib/format'
import type { EfficiencyTrendPoint } from '../types'

interface EfficiencySnapshotCardProps {
  trend: EfficiencyTrendPoint[] // 5 points, oldest to newest; last = current week
}

function formatPerHour(value: number | null): string {
  return value === null ? '—' : `${formatCurrency(value)}/hr`
}

function formatRatio(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)}x`
}

function PreviousWeeks({ weeks }: { weeks: EfficiencyTrendPoint[] }) {
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
            <td className="pr-4 text-gray-500">Sales/Hr</td>
            {weeks.map((point) => (
              <td key={point.weekStart} className="px-3 text-right text-gray-600">
                {formatPerHour(point.salesPerLaborHour)}
              </td>
            ))}
          </tr>
          <tr>
            <td className="pr-4 text-gray-500">Rev Factor</td>
            {weeks.map((point) => (
              <td key={point.weekStart} className="px-3 text-right text-gray-600">
                {formatRatio(point.revenueFactor)}
                {point.hasNullCost && point.revenueFactor !== null ? '*' : ''}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function EfficiencySnapshotCard({ trend }: EfficiencySnapshotCardProps) {
  const currentWeek = trend[trend.length - 1]
  const previousWeeks = trend.slice(0, -1).reverse()
  const showAsterisk = currentWeek?.hasNullCost && currentWeek?.revenueFactor !== null
  return (
    <Card title="Efficiency Snapshot">
      <div className="flex flex-wrap gap-8">
        <StatTile label="Sales Per Labor Hour" value={formatPerHour(currentWeek?.salesPerLaborHour ?? null)} />
        <StatTile
          label="Revenue Factor"
          value={`${formatRatio(currentWeek?.revenueFactor ?? null)}${showAsterisk ? '*' : ''}`}
        />
      </div>
      {previousWeeks.length > 0 && <PreviousWeeks weeks={previousWeeks} />}
      {currentWeek?.hasNullCost && (
        <p className="mt-2 text-xs text-gray-400">
          * incomplete — some labor cost entries are missing
        </p>
      )}
    </Card>
  )
}