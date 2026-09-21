export interface RowError {
  rowNumber: number // 1-based, matches the CSV including its header row.
                     // 0 means "the whole file," not one row — see below.
  reason: string
  raw: Record<string, string>
}

export interface ImportResult {
  totalRows: number
  inserted: number
  updated: number
  skipped: number
  failed: number
  errors: RowError[]
  skippedRows: RowError[]
}