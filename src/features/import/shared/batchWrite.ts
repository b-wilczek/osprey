import type { SupabaseClient } from '@supabase/supabase-js'
import type { RowError } from './types'
import type { WriteItem } from './splitInsertsAndUpdates'

interface BatchWriteResult {
  succeeded: number
  errors: RowError[]
}

// Tries one batch call first — far fewer round trips for a large file.
// If Postgres rejects the WHOLE batch (one row collides with a unique
// constraint the natural-key lookup didn't catch), retries row-by-row so
// everything else in the batch still commits, and names the specific row
// that failed instead of one opaque error for the whole file.
async function writeBatch(
  supabase: SupabaseClient,
  table: string,
  items: WriteItem[],
  mode: { kind: 'insert' } | { kind: 'upsert'; onConflict: string },
  failureVerb: 'Insert' | 'Update'
): Promise<BatchWriteResult> {
  if (items.length === 0) return { succeeded: 0, errors: [] }

  const records = items.map((i) => i.record)
  const { error } =
    mode.kind === 'insert'
      ? await supabase.from(table).insert(records)
      : await supabase.from(table).upsert(records, { onConflict: mode.onConflict })

  if (!error) return { succeeded: items.length, errors: [] }

  const errors: RowError[] = []
  let succeeded = 0
  for (const { record, rowNumber } of items) {
    const { error: rowError } =
      mode.kind === 'insert'
        ? await supabase.from(table).insert(record)
        : await supabase.from(table).upsert(record, { onConflict: mode.onConflict })

    if (rowError) {
      errors.push({
        rowNumber,
        raw: record as Record<string, string>,
        reason: `${failureVerb} failed: ${rowError.message}`,
      })
    } else {
      succeeded++
    }
  }
  return { succeeded, errors }
}

export function insertRows(supabase: SupabaseClient, table: string, items: WriteItem[]) {
  return writeBatch(supabase, table, items, { kind: 'insert' }, 'Insert')
}

export function upsertRows(
  supabase: SupabaseClient,
  table: string,
  items: WriteItem[],
  onConflict: string
) {
  return writeBatch(supabase, table, items, { kind: 'upsert', onConflict }, 'Update')
}