import { createClient } from '@/lib/supabase/server'
import { getWeekEnd, shiftWeek } from '@/lib/weeks'
import { formatShortDate, formatTime12h, formatMonthDay } from '@/lib/format'
import { cache } from 'react'
import type {
  WasteFilters,
  WasteItemTotal,
  WasteWeeklyItem,
  EightySixEvent,
  LaborSnapshot,
  EfficiencySnapshot,
  RevenueTrendPoint,
  LaborTrendPoint,
  EfficiencyTrendPoint
} from './types'

const CMU_LOCATIONS = ['CMU-Hunt', 'CMU-Resnik']

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
    .gt('waste_amount', 0) // drops zero-waste rows — see Waste Card guide notes

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

interface FoodItemPriceRow {
  item_name: string
  price: number | string | null
}

async function getFoodItemPrices(location: string): Promise<Map<string, number>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('food_items')
    .select('item_name, price')
    .eq('location', location)

  if (error) {
    console.error('getFoodItemPrices failed:', error.message)
    return new Map()
  }

  const prices = new Map<string, number>()
  for (const row of (data ?? []) as FoodItemPriceRow[]) {
    if (row.price === null || row.price === undefined) continue
    prices.set(row.item_name, Number(row.price))
  }
  return prices
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

   const [{ data: rows, error }, prices] = await Promise.all([
    supabase
      .from('waste_data')
      .select('report_date, item_name, waste_amount')
      .eq('location', location)
      .gte('report_date', lastWeekStart)
      .lte('report_date', thisWeekEnd),
    getFoodItemPrices(location),
  ])

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
      const price = prices.get(itemName)
      const dollarLost =
        thisWeekTotal === 0 ? 0 : price !== undefined ? thisWeekTotal * price : null

      return {
        itemName,
        thisWeekTotal,
        lastWeekTotal,
        diff: thisWeekTotal - lastWeekTotal,
        dollarLost,
      }
    })
    .filter((item) => item.thisWeekTotal !== 0 || item.lastWeekTotal !== 0) // skip 0/0
    .sort((a, b) => b.thisWeekTotal - a.thisWeekTotal)
}

// Explicit row shape for the 86 Snapshot query below — without generated
// Database types, an untyped Supabase client can leave `data`'s element
// type unresolved enough that `.map()`'s callback parameter gets flagged
// as implicitly `any`. Annotating it here sidesteps that outright.
interface EightySixRow {
  report_date: string
  item_name: string
  time_86ed: string | null
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
    .order('item_name', { ascending: true })
    .order('report_date', { ascending: true })
    .order('time_86ed', { ascending: true })

  if (error) {
    console.error('getEightySixSnapshot failed:', error.message)
    return []
  }

  return ((data ?? []) as EightySixRow[]).map((row) => ({
    itemName: row.item_name,
    reportDate: row.report_date,
    dateDisplay: formatShortDate(row.report_date),
    timeDisplay: formatTime12h(row.time_86ed),
  }))
}

// (2026-09-27) Wrapped in cache() so a second call with the same
// (weekStart, location) during the same server render -- e.g. from both
// this card's own trend and Efficiency Snapshot's trend -- reuses the
// first call's in-flight result instead of re-querying Supabase. Same
// reasoning, and the same positional-args requirement, as Revenue
// Snapshot's getRevenueSnapshot -- see that guide's 2026-09-27 update
// note for the full explanation.
export const getLaborSnapshot = cache(
  async (weekStart: string, location: string): Promise<LaborSnapshot> => {
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
)

// (2026-09-27) Same pattern as getRevenueTrend: 5 weeks (current + 4
// prior), fetched in parallel by calling the already-tested
// getLaborSnapshot once per week rather than writing a new combined
// range query. getLaborSnapshot is called positionally now (see above).
export async function getLaborTrend({
  weekStart,
  location,
}: {
  weekStart: string // Monday, 'YYYY-MM-DD' — the most recent (current) week
  location: string
}): Promise<LaborTrendPoint[]> {
  // oldest → newest: 4 weeks ago, 3 weeks ago, ..., the current week last
  const weekStarts = [4, 3, 2, 1, 0].map((weeksAgo) => shiftWeek(weekStart, -weeksAgo))

  const weeks = await Promise.all(
    weekStarts.map((ws) => getLaborSnapshot(ws, location))
  )

  return weekStarts.map((ws, i) => ({
    weekStart: ws,
    weekLabel: formatMonthDay(ws),
    totalHours: weeks[i].totalHours,
    totalCost: weeks[i].totalCost,
    hasNullCost: weeks[i].hasNullCost,
  }))
}



// Same reasoning as EightySixRow above — explicit shape for the aggregating
// views' single column so `.reduce()`'s callback parameter doesn't get
// flagged as implicitly `any`.
interface DailySalesRow {
  total_sales: number | string | null
}

export const getRevenueSnapshot = cache(
  async (weekStart: string, location: string): Promise<number> => {
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

    return ((data ?? []) as DailySalesRow[]).reduce(
      (sum, row) => sum + Number(row.total_sales ?? 0),
      0
    )
  }
)

export async function getEfficiencySnapshot({
  weekStart,
  location,
}: {
  weekStart: string // Monday, 'YYYY-MM-DD'
  location: string
}): Promise<EfficiencySnapshot> {
  const [totalSales, labor] = await Promise.all([
    getRevenueSnapshot(weekStart, location),
    getLaborSnapshot(weekStart, location),
  ])

  return {
    salesPerLaborHour: labor.totalHours > 0 ? totalSales / labor.totalHours : null,
    revenueFactor: labor.totalCost > 0 ? labor.totalCost / totalSales : null,
    hasNullCost: labor.hasNullCost,
  }
}

export async function getEfficiencyTrend({
  weekStart,
  location,
}: {
  weekStart: string // Monday, 'YYYY-MM-DD' — the most recent (current) week
  location: string
}): Promise<EfficiencyTrendPoint[]> {
  // oldest → newest: 4 weeks ago, 3 weeks ago, ..., the current week last
  const weekStarts = [4, 3, 2, 1, 0].map((weeksAgo) => shiftWeek(weekStart, -weeksAgo))

  const weeks = await Promise.all(
    weekStarts.map((ws) => getEfficiencySnapshot({ weekStart: ws, location }))
  )

  return weekStarts.map((ws, i) => ({
    weekStart: ws,
    weekLabel: formatMonthDay(ws),
    salesPerLaborHour: weeks[i].salesPerLaborHour,
    revenueFactor: weeks[i].revenueFactor,
    hasNullCost: weeks[i].hasNullCost,
  }))
}

export async function getRevenueTrend({
  weekStart,
  location,
}: {
  weekStart: string // Monday, 'YYYY-MM-DD' — the most recent (current) week
  location: string
}): Promise<RevenueTrendPoint[]> {
  // oldest → newest: 4 weeks ago, 3 weeks ago, ..., the current week last
  const weekStarts = [4, 3, 2, 1, 0].map((weeksAgo) => shiftWeek(weekStart, -weeksAgo))

  const metrics = await Promise.all(
    weekStarts.map((ws) => getRevenueWeekMetrics({ weekStart: ws, location }))
  )

  return weekStarts.map((ws, i) => ({
    weekStart: ws,
    weekLabel: formatMonthDay(ws),
    totalSales: metrics[i].totalSales,
    ticketCount: metrics[i].ticketCount,
    ticketAvg: metrics[i].ticketAvg,
  }))
}

interface DailyTicketRow {
  ticket_count: number | string
  valid_ticket_sum: number | string | null
  valid_ticket_count: number | string
}

function sumDailyTickets(
  rows: DailyTicketRow[]
): { ticketCount: number; ticketAvg: number | null } {
  let ticketCount = 0
  let validSum = 0
  let validCount = 0

  for (const row of rows) {
    ticketCount += Number(row.ticket_count ?? 0)
    validSum += Number(row.valid_ticket_sum ?? 0)
    validCount += Number(row.valid_ticket_count ?? 0)
  }

  return {
    ticketCount,
    ticketAvg: validCount > 0 ? validSum / validCount : null,
  }
}

async function getTicketMetrics({
  weekStart,
  location,
}: {
  weekStart: string // Monday, 'YYYY-MM-DD'
  location: string
}): Promise<{ ticketCount: number; ticketAvg: number | null }> {
  const supabase = await createClient()
  const weekEnd = getWeekEnd(weekStart)
  const table = CMU_LOCATIONS.includes(location) ? 'cmu_daily_tickets' : 'square_daily_tickets'

  const { data, error } = await supabase
    .from(table)
    .select('ticket_count, valid_ticket_sum, valid_ticket_count')
    .eq('location', location)
    .gte('order_date', weekStart)
    .lte('order_date', weekEnd)

  if (error) {
    console.error(`getTicketMetrics (${table}) failed:`, error.message)
    return { ticketCount: 0, ticketAvg: null }
  }

  return sumDailyTickets((data ?? []) as DailyTicketRow[])
}

async function getRevenueWeekMetrics({
  weekStart,
  location,
}: {
  weekStart: string
  location: string
}): Promise<{ totalSales: number; ticketCount: number; ticketAvg: number | null }> {
  const [totalSales, ticketMetrics] = await Promise.all([
    getRevenueSnapshot(weekStart, location),
    getTicketMetrics({ weekStart, location }),
  ])

  return { totalSales, ...ticketMetrics }
}