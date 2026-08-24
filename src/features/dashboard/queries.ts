import { createClient } from '@/lib/supabase/server'
import type { WasteFilters, WasteItemTotal, WasteWeeklyItem, EightySixEvent } from './types'
import { getWeekEnd, shiftWeek } from '@/lib/weeks'
import { formatShortDate, formatTime12h } from '@/lib/format'


export async function getWasteTotals({
  startDate,
  endDate,
  location,
}: WasteFilters): Promise<WasteItemTotal[]> {
  const supabase = await createClient()

  let query = supabase
    .from('waste_data')
    .select('item_name, waste_amount')
    .gte('report_date', startDate)
    .lte('report_date', endDate)
    .gt('waste_amount', 0) // drops zero-waste rows — see guide notes

  if (location) {
    query = query.eq('location', location)
  }

  const { data, error } = await query

  if (error) {
    console.error('getWasteTotals failed:', error.message)
    return []
  }

  const totals = new Map<string, number>()
  for (const row of data ?? []) {
    const current = totals.get(row.item_name) ?? 0
    totals.set(row.item_name, current + row.waste_amount)
  }

  return Array.from(totals.entries())
    .map(([itemName, totalWaste]) => ({ itemName, totalWaste }))
    .sort((a, b) => b.totalWaste - a.totalWaste)
}

export async function getWasteLocations(): Promise<string[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.from('waste_locations').select('location')

  if (error) {
    console.error('getWasteLocations failed:', error.message)
    return []
  }

  return (data ?? []).map((row) => row.location as string).filter(Boolean)
}

export async function getWasteWeeklySnapshot({
  weekStart,
  location,
}: {
  weekStart: string // Monday, 'YYYY-MM-DD'
  location: string
}): Promise<WasteWeeklyItem[]> {
  const supabase = await createClient()

  const thisWeekEnd = getWeekEnd(weekStart)
  const lastWeekStart = shiftWeek(weekStart, -1)

  const { data: rows, error } = await supabase
    .from('waste_data')
    .select('report_date, item_name, waste_amount')
    .eq('location', location)
    .gte('report_date', lastWeekStart)
    .lte('report_date', thisWeekEnd)

  if (error) {
    console.error('getWasteWeeklySnapshot failed:', error.message)
    return []
  }

  const thisWeekTotals = new Map<string, number>()
  const lastWeekTotals = new Map<string, number>()

  for (const row of rows ?? []) {
    // one query spans both weeks (lastWeekStart..thisWeekEnd) — bucket each
    // row by whether its date falls in this week or last week.
    const bucket = row.report_date >= weekStart ? thisWeekTotals : lastWeekTotals
    const current = bucket.get(row.item_name) ?? 0
    bucket.set(row.item_name, current + Number(row.waste_amount ?? 0))
  }

  // the item universe is whatever actually showed up in these two weeks —
  // no separate items table needed, and it's correct for any week you look
  // at, past or present.
  const allItemNames = new Set([...thisWeekTotals.keys(), ...lastWeekTotals.keys()])

  return Array.from(allItemNames)
    .map((itemName) => {
      const thisWeekTotal = thisWeekTotals.get(itemName) ?? 0
      const lastWeekTotal = lastWeekTotals.get(itemName) ?? 0
      return { itemName, thisWeekTotal, lastWeekTotal, diff: thisWeekTotal - lastWeekTotal }
    })
    .filter((item) => item.thisWeekTotal !== 0 || item.lastWeekTotal !== 0) // skip 0/0
    .sort((a, b) => b.thisWeekTotal - a.thisWeekTotal)
}

export async function getEightySixSnapshot({
  weekStart,
  location,
}: {
  weekStart: string // Monday, 'YYYY-MM-DD'
  location: string
}): Promise<EightySixEvent[]> {
  const supabase = await createClient()

  const weekEnd = getWeekEnd(weekStart)

  const { data, error } = await supabase
    .from('waste_data')
    .select('report_date, item_name, time_86ed')
    .eq('location', location)
    .eq('is_86ed', true)
    .gte('report_date', weekStart)
    .lte('report_date', weekEnd)
    .order('report_date', { ascending: true })
    .order('time_86ed', { ascending: true })

  if (error) {
    console.error('getEightySixSnapshot failed:', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    itemName: row.item_name as string,
    reportDate: row.report_date as string,
    dateDisplay: formatShortDate(row.report_date as string),
    timeDisplay: formatTime12h(row.time_86ed as string | null),
  }))
}

export async function getLaborSnapshot({
  weekStart,
  location,
}: {
  weekStart: string // Monday, 'YYYY-MM-DD'
  location: string
}): Promise<LaborSnapshot> {
  const supabase = await createClient()

  const weekEnd = getWeekEnd(weekStart)

  const { data, error } = await supabase
    .from('timesheet_data')
    .select('total_hours, cost, is_leave')
    .eq('location', location)
    .gte('timesheet_date', weekStart)
    .lte('timesheet_date', weekEnd)

  if (error) {
    console.error('getLaborSnapshot failed:', error.message)
    return { totalHours: 0, totalCost: 0, hasNullCost: false }
  }

  let totalHours = 0
  let totalCost = 0
  let hasNullCost = false

  for (const row of data ?? []) {
    if (row.is_leave === true) continue // fallback — shouldn't normally have a location at all

    totalHours += Number(row.total_hours ?? 0)

    if (row.cost === null || row.cost === undefined) {
      hasNullCost = true
    } else {
      totalCost += Number(row.cost)
    }
  }

  return { totalHours, totalCost, hasNullCost }
}

const CMU_LOCATIONS = ['CMU-Hunt', 'CMU-Resnik']

export async function getRevenueSnapshot({
  weekStart,
  location,
}: {
  weekStart: string // Monday, 'YYYY-MM-DD'
  location: string
}): Promise<number> {
  const supabase = await createClient()

  const weekEnd = getWeekEnd(weekStart)
  const view = CMU_LOCATIONS.includes(location) ? 'cmu_daily_sales' : 'square_daily_sales'

  const { data, error } = await supabase
    .from(view)
    .select('total_sales')
    .eq('location', location)
    .gte('order_date', weekStart)
    .lte('order_date', weekEnd)

  if (error) {
    console.error('getRevenueSnapshot failed:', error.message)
    return 0
  }

  return (data ?? []).reduce((sum, row) => sum + Number(row.total_sales ?? 0), 0)
}

export async function getEfficiencySnapshot({
  weekStart,
  location,
}: {
  weekStart: string // Monday, 'YYYY-MM-DD'
  location: string
}): Promise<EfficiencySnapshot> {
  const [totalSales, labor] = await Promise.all([
    getRevenueSnapshot({ weekStart, location }),
    getLaborSnapshot({ weekStart, location }),
  ])

  return {
    salesPerLaborHour: labor.totalHours > 0 ? totalSales / labor.totalHours : null,
    revenueFactor: labor.totalCost > 0 ? totalSales / labor.totalCost : null,
    hasNullCost: labor.hasNullCost,
  }
}