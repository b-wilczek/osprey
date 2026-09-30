'use client'

import { useOptimistic, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Spinner } from '@/components/ui/Spinner'
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
  const [isPending, startTransition] = useTransition()

  // What the controls *show*. Updates instantly on click; snaps back to the
  // real props once the server render finishes (by then they're equal).
  const [shownWeek, setShownWeek] = useOptimistic(weekStart)
  const [shownLocation, setShownLocation] = useOptimistic(location)

  const weekInfo = getWeekInfo(shownWeek)
  const isCurrentWeek = shownWeek === getWeekStart(todayISODate())

  const navigate = (key: 'week' | 'location', value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    startTransition(() => {
      if (key === 'week') setShownWeek(value)
      else setShownLocation(value)
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const goToWeek = (newWeekStart: string) => navigate('week', newWeekStart)

  return (
    <div className="mb-6 flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => goToWeek(shiftWeek(shownWeek, -1))}
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
          onClick={() => goToWeek(shiftWeek(shownWeek, 1))}
          disabled={isCurrentWeek}
          aria-label="Next week"
          className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          →
        </button>

        <input
          type="date"
          aria-label="Jump to a date"
          value={shownWeek}
          onChange={(e) => e.target.value && goToWeek(getWeekStart(e.target.value))}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        Location
        <select
          value={shownLocation}
          onChange={(e) => navigate('location', e.target.value)}
          className="rounded border border-gray-300 px-2 py-1"
        >
          {locations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </label>

      {/* Fixed-size slot so the row doesn't jump when the spinner appears */}
      <span className="flex h-4 w-4 items-center" aria-live="polite">
        {isPending && <Spinner label="Loading dashboard" />}
      </span>
    </div>
  )
}