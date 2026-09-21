export interface WasteItemTotal {
  itemName: string
  totalWaste: number
}

export interface WasteFilters {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  location: string | null // null = all locations
}

export interface WasteWeeklyItem {
  itemName: string
  thisWeekTotal: number
  lastWeekTotal: number
  diff: number // thisWeekTotal - lastWeekTotal; negative = down vs. last week
  dollarLost: number | null // thisWeekTotal × Food Items price for this
                             // location; null only if thisWeekTotal > 0 and
                             // no matching price was found
}

export interface EightySixEvent {
  itemName: string
  reportDate: string // raw 'YYYY-MM-DD' — kept for the row key
  dateDisplay: string // e.g. 'Mon, Aug 17'
  timeDisplay: string // e.g. '6:00 PM', or '—' if missing
}

export interface LaborSnapshot {
  totalHours: number
  totalCost: number
  hasNullCost: boolean // true if any matching row's cost was NULL
}

export interface EfficiencySnapshot {
  salesPerLaborHour: number | null // null if total labor hours are 0
  revenueFactor: number | null // null if total labor cost is 0
  hasNullCost: boolean // from getLaborSnapshot — drives the Revenue Factor asterisk
}

export interface RevenueTrendPoint {
  weekStart: string // Monday, 'YYYY-MM-DD'
  weekLabel: string // e.g. 'Aug 17'
  totalSales: number
  ticketCount: number
  ticketAvg: number | null // null if there were no tickets with a real (non-$0, non-NULL) total
}