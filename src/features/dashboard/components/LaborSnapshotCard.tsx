'use client'

import { Card } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/StatTile'
import { formatCurrency } from '@/lib/format'
import type { LaborSnapshot } from '../types'

interface LaborSnapshotCardProps {
  data: LaborSnapshot
}

export function LaborSnapshotCard({ data }: LaborSnapshotCardProps) {
  const costValue = `${formatCurrency(data.totalCost)}${data.hasNullCost ? '*' : ''}`

  return (
    <Card title="Labor Snapshot">
      <div className="flex flex-wrap gap-8">
        <StatTile label="Total Hours" value={`${data.totalHours.toFixed(1)} hrs`} />
        <StatTile
          label="Total Cost"
          value={costValue}
          footnote={
            data.hasNullCost ? '* incomplete — some entries are missing a cost' : undefined
          }
        />
      </div>
    </Card>
  )
}