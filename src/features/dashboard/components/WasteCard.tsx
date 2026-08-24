'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Table, type Column } from '@/components/ui/Table'
import type { WasteItemTotal } from '../types'

interface WasteCardProps {
  data: WasteItemTotal[]
  locations: string[]
  initialStartDate: string
  initialEndDate: string
  initialLocation: string
}

const columns: Column<WasteItemTotal>[] = [
  { key: 'itemName', label: 'Item', sortable: true },
  { key: 'totalWaste', label: 'Total Waste', sortable: true },
]

export function WasteCard({
  data,
  locations,
  initialStartDate,
  initialEndDate,
  initialLocation,
}: WasteCardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`${pathname}?${params.toString()}`)
  }

  const filteredData = useMemo(() => {
    if (!search.trim()) return data
    const q = search.trim().toLowerCase()
    return data.filter((row) => row.itemName.toLowerCase().includes(q))
  }, [data, search])

  return (
    <Card title="Waste">
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-sm text-gray-600">
          From
          <input
            type="date"
            defaultValue={initialStartDate}
            onChange={(e) => updateFilter('wasteStart', e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm text-gray-600">
          To
          <input
            type="date"
            defaultValue={initialEndDate}
            onChange={(e) => updateFilter('wasteEnd', e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm text-gray-600">
          Location
          <select
            defaultValue={initialLocation}
            onChange={(e) => updateFilter('wasteLocation', e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          >
            <option value="ALL">All Locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm text-gray-600">
          Search
          <input
            type="text"
            list="waste-item-names"
            placeholder="Find an item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <datalist id="waste-item-names">
          {data.map((row) => (
            <option key={row.itemName} value={row.itemName} />
          ))}
        </datalist>
      </div>

      {filteredData.length === 0 ? (
        <p className="text-sm text-gray-500">No waste recorded for this range.</p>
      ) : (
        <Table
          columns={columns}
          data={filteredData}
          getRowKey={(row) => row.itemName}
          initialSortKey="totalWaste"
          initialSortDirection="desc"
        />
      )}
    </Card>
  )
}