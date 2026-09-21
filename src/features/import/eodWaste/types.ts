export interface EodWasteRow {
  submittedAt: string // ISO 8601, e.g. 2026-08-16T17:28:13 -- converted from the real M/D/YYYY HH:MM:SS export format by toIsoTimestamp() in validation.ts
  reportDate: string // YYYY-MM-DD -- converted from the real M/D/YYYY export format by toIsoDate() in validation.ts
  userEmail: string | null
  userName: string | null
  location: string
  itemName: string
  wasteAmount: number | null
  is86ed: boolean
  timeOut: string | null // stored exactly as given -- see this guide's notes on why this isn't parsed
  notes: string | null
  noFoodWasteToday: boolean
  no86sToday: boolean
}