import { createClient } from '@/lib/supabase/server'

interface DatasetConfig {
  label: string
  view: string
  column: string
  // Order Details (CMU)'s Date & Time is a timestamp, not a plain date —
  // see this section's notes above on why its value is truncated to just
  // the date portion for display here.
  isTimestamp?: boolean
}

const DATASETS: DatasetConfig[] = [
  { label: 'End of Day 86+Waste', view: 'waste_data', column: 'report_date' },
  { label: 'Order Details (CMU)', view: 'order_details_cmu', column: 'date_time', isTimestamp: true },
  { label: 'Timesheet Data', view: 'timesheet_data', column: 'timesheet_date' },
  { label: 'Transaction Details (CMU)', view: 'transaction_details_cmu', column: 'order_date' },
  { label: 'Transaction Details (Square)', view: 'transaction_details', column: 'date' },
]

export interface DatasetRange {
  label: string
  oldest: string | null // 'YYYY-MM-DD', or null if the table has no rows yet
  newest: string | null // 'YYYY-MM-DD', or null if the table has no rows yet
}

// 'YYYY-MM-DDTHH:MM:SS' -> 'YYYY-MM-DD'. A no-op on a value that's
// already just a date.
function dateOnly(value: string): string {
  return value.slice(0, 10)
}

export async function getDatasetDateRanges(): Promise<DatasetRange[]> {
  const supabase = await createClient()

  return Promise.all(
    DATASETS.map(async ({ label, view, column, isTimestamp }) => {
      const [{ data: oldestRows, error: oldestError }, { data: newestRows, error: newestError }] =
        await Promise.all([
          supabase.from(view).select(column).order(column, { ascending: true, nullsFirst: false }).limit(1),
          supabase.from(view).select(column).order(column, { ascending: false, nullsFirst: false }).limit(1),
        ])

      if (oldestError || newestError) {
        console.error(
          `getDatasetDateRanges failed for ${view}.${column}:`,
          oldestError?.message ?? newestError?.message
        )
        return { label, oldest: null, newest: null }
      }

    const oldestRaw = (oldestRows?.[0] as unknown as Record<string, string> | undefined)?.[column] ?? null
    const newestRaw = (newestRows?.[0] as unknown as Record<string, string> | undefined)?.[column] ?? null

      return {
        label,
        oldest: oldestRaw ? (isTimestamp ? dateOnly(oldestRaw) : oldestRaw) : null,
        newest: newestRaw ? (isTimestamp ? dateOnly(newestRaw) : newestRaw) : null,
      }
    })
  )
}