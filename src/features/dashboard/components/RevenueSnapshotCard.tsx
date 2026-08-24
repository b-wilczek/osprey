'use client'

import { Card } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/StatTile'
import { formatCurrency } from '@/lib/format'

interface RevenueSnapshotCardProps {
  totalSales: number
}

export function RevenueSnapshotCard({ totalSales }: RevenueSnapshotCardProps) {
  return (
    <Card title="Revenue Snapshot">
      <StatTile label="Total Sales" value={formatCurrency(totalSales)} />
    </Card>
  )
}