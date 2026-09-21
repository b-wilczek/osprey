export interface TimesheetRow {
  displayName: string
  timesheetDate: string // YYYY-MM-DD
  startTime: string // HH:MM:SS
  endTime: string // HH:MM:SS
  totalHours: number
  cost: number | null // null is expected — see guide notes
  location: string | null // null for "On Leave" rows — see guide notes
  isLeave: boolean
}

export interface RowError {
  rowNumber: number // 1-based, matches the CSV including its header row
  reason: string
  raw: Record<string, string>
}

export interface ImportResult {
  totalRows: number
  inserted: number
  updated: number
  failed: number
  errors: RowError[]
}