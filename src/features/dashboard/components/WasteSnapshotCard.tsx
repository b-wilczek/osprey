'use client'

import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/format'
import type { WasteWeeklyItem } from '../types'

interface WasteSnapshotCardProps {
  data: WasteWeeklyItem[]
}

function DiffCell({ diff }: { diff: number }) {
  if (diff === 0) return <span>0</span>
  const isDown = diff < 0 // less waste than last week — good
  return (
    <span className={isDown ? 'text-green-600' : 'text-red-600'}>
      {isDown ? '▼' : '▲'} {diff > 0 ? `+${diff}` : diff}
    </span>
  )
}

function DollarLostCell({ dollarLost }: { dollarLost: number | null }) {
  if (dollarLost === null) return <span className="text-gray-400">—</span>
  return <span>{formatCurrency(dollarLost)}</span>
}

export function WasteSnapshotCard({ data }: WasteSnapshotCardProps) {
  const totalThisWeek = data.reduce((sum, row) => sum + row.thisWeekTotal, 0)
  const totalLastWeek = data.reduce((sum, row) => sum + row.lastWeekTotal, 0)
  const totalDiff = totalThisWeek - totalLastWeek
  const totalDollarLost = data.reduce((sum, row) => sum + (row.dollarLost ?? 0), 0)
  const hasMissingPrice = data.some((row) => row.dollarLost === null)

  return (
    <Card title="Waste Snapshot">
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">
          No waste recorded for this location in either week.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded border border-gray-200">
            {/* max-h ≈ header + 5 rows + footer at ~40px each — tune to taste */}
            <div className="max-h-[280px] overflow-y-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="border-b-2 border-gray-200 bg-white px-3 py-2 text-left font-medium text-gray-600">
                      Item
                    </th>
                    <th className="border-b-2 border-gray-200 bg-white px-3 py-2 text-right font-medium text-gray-600">
                      This Week
                    </th>
                    <th className="border-b-2 border-gray-200 bg-white px-3 py-2 text-right font-medium text-gray-600">
                      $ Lost (Sales Price)
                    </th>
                    <th className="border-b-2 border-gray-200 bg-white px-3 py-2 text-right font-medium text-gray-600">
                      Vs Last Week
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.itemName} className="hover:bg-gray-50">
                      <td className="border-b border-gray-100 px-3 py-2">{row.itemName}</td>
                      <td className="border-b border-gray-100 px-3 py-2 text-right">
                        {row.thisWeekTotal}
                      </td>
                      <td className="border-b border-gray-100 px-3 py-2 text-right">
                        <DollarLostCell dollarLost={row.dollarLost} />
                      </td>
                      <td className="border-b border-gray-100 px-3 py-2 text-right">
                        <DiffCell diff={row.diff} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-10">
                  <tr>
                    <td className="border-t-2 border-gray-200 bg-gray-50 px-3 py-2 font-semibold">
                      Total
                    </td>
                    <td className="border-t-2 border-gray-200 bg-gray-50 px-3 py-2 text-right font-semibold">
                      {totalThisWeek}
                    </td>
                    <td className="border-t-2 border-gray-200 bg-gray-50 px-3 py-2 text-right font-semibold">
                      {formatCurrency(totalDollarLost)}
                      {hasMissingPrice ? '*' : ''}
                    </td>
                    <td className="border-t-2 border-gray-200 bg-gray-50 px-3 py-2 text-right font-semibold">
                      <DiffCell diff={totalDiff} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          {hasMissingPrice && (
            <p className="mt-2 text-xs text-gray-400">
              * incomplete — one or more items are missing a price in Food Items for this
              location, shown as "—" and excluded from the total
            </p>
          )}
        </>
      )}
    </Card>
  )
}