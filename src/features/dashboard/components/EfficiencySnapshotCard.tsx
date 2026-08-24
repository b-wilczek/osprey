'use client'

import { Card } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/StatTile'
import { formatCurrency } from '@/lib/format'
import type { EfficiencySnapshot } from '../types'

interface EfficiencySnapshotCardProps {
  data: EfficiencySnapshot
}

function formatPerHour(value: number | null): string {
  return value === null ? '—' : `${formatCurrency(value)}/hr`
}

function formatRatio(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)}x`
}

export function EfficiencySnapshotCard({ data }: EfficiencySnapshotCardProps) {
  const showAsterisk = data.hasNullCost && data.revenueFactor !== null

  return (
    <Card title="Efficiency Snapshot">
      <div className="flex flex-wrap gap-8">
        <StatTile label="Sales Per Labor Hour" value={formatPerHour(data.salesPerLaborHour)} />
        <StatTile
          label="Revenue Factor"
          value={`${formatRatio(data.revenueFactor)}${showAsterisk ? '*' : ''}`}
          footnote={
            data.hasNullCost ? '* incomplete — some labor cost entries are missing' : undefined
          }
        />
      </div>
    </Card>
  )
}