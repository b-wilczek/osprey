'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getWeekInfo, getWeekStart, shiftWeek, todayISODate } from '@/lib/weeks'

interface DashboardControlsProps {
  weekStart: string
  location: string
  locations: string[]
}

export function DashboardControls({ weekStart, location, locations }: DashboardControlsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const weekInfo = getWeekInfo(weekStart)
  const isCurrentWeek = weekStart === getWeekStart(todayISODate())

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`${pathname}?${params.toString()}`)
  }

  const goToWeek = (newWeekStart: string) => updateParam('week', newWeekStart)

  return (
    <div className="mb-6 flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => goToWeek(shiftWeek(weekStart, -1))}
          aria-label="Previous week"
          className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50"
        >
          ←
        </button>

        <span className="min-w-[220px] text-center text-sm font-medium text-gray-700">
          {weekInfo.label}
        </span>

        <button
          type="button"
          onClick={() => goToWeek(shiftWeek(weekStart, 1))}
          disabled={isCurrentWeek}
          aria-label="Next week"
          className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          →
        </button>

        <input
          type="date"
          aria-label="Jump to a date"
          value={weekStart}
          onChange={(e) => e.target.value && goToWeek(getWeekStart(e.target.value))}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        Location
        <select
          value={location}
          onChange={(e) => updateParam('location', e.target.value)}
          className="rounded border border-gray-300 px-2 py-1"
        >
          {locations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}