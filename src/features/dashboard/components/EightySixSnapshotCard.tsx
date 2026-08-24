'use client'

import { Card } from '@/components/ui/Card'
import type { EightySixEvent } from '../types'

interface EightySixSnapshotCardProps {
  data: EightySixEvent[]
}

export function EightySixSnapshotCard({ data }: EightySixSnapshotCardProps) {
  return (
    <Card title="86 Snapshot">
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">No 86s recorded for this location this week.</p>
      ) : (
        <div className="overflow-hidden rounded border border-gray-200">
          {/* Same max-h as Waste Snapshot's scroll container, for visual
              consistency between the two cards — no footer here, so a bit
              more than 5 rows will actually be visible. */}
          <div className="max-h-[280px] overflow-y-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="border-b-2 border-gray-200 bg-white px-3 py-2 text-left font-medium text-gray-600">
                    Date
                  </th>
                  <th className="border-b-2 border-gray-200 bg-white px-3 py-2 text-left font-medium text-gray-600">
                    Item
                  </th>
                  <th className="border-b-2 border-gray-200 bg-white px-3 py-2 text-right font-medium text-gray-600">
                    86'd At
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((event, i) => (
                  <tr
                    key={`${event.reportDate}-${event.itemName}-${i}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="border-b border-gray-100 px-3 py-2 text-gray-600 whitespace-nowrap">
                      {event.dateDisplay}
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 text-gray-600">{event.itemName}</td>
                    <td className="border-b border-gray-100 px-3 py-2 text-gray-600 text-right whitespace-nowrap">
                      {event.timeDisplay}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  )
}