'use client'

import { useMemo, useState } from 'react'

export interface Column<T> {
  key: keyof T
  label: string
  sortable?: boolean
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  getRowKey: (row: T) => string
  initialSortKey?: keyof T
  initialSortDirection?: 'asc' | 'desc'
}

export function Table<T>({
  columns,
  data,
  getRowKey,
  initialSortKey,
  initialSortDirection = 'asc',
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | undefined>(initialSortKey)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    initialSortDirection
  )

  const sortedData = useMemo(() => {
    if (!sortKey) return data
    const copy = [...data]
    copy.sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal === bVal) return 0
      const result = aVal > bVal ? 1 : -1
      return sortDirection === 'asc' ? result : -result
    })
    return copy
  }, [data, sortKey, sortDirection])

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={String(col.key)}
              onClick={() => col.sortable && handleSort(col.key)}
              className={`border-b-2 border-gray-200 px-3 py-2 text-left font-medium text-gray-600 ${
                col.sortable ? 'cursor-pointer select-none hover:text-gray-900' : ''
              }`}
            >
              {col.label}
              {sortKey === col.key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedData.map((row) => (
          <tr key={getRowKey(row)} className="hover:bg-gray-50">
            {columns.map((col) => (
              <td
                key={String(col.key)}
                className="border-b border-gray-100 px-3 py-2 text-gray-900"
              >
                {String(row[col.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}