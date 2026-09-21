'use server'

import { createClient } from '@/lib/supabase/server'
import { parseCsvText } from '../shared/parseCsv'
import { checkRequiredHeaders } from '../shared/validateHeaders'
import { splitInsertsAndUpdates } from '../shared/splitInsertsAndUpdates'
import { insertRows } from '../shared/batchWrite'
import { fetchExistingKeys } from '../shared/fetchExistingKeys'
import type { ImportResult, RowError } from '../shared/types'
import { validateRow, REQUIRED_HEADERS } from './validation'
import type { OrderDetailCmuRow } from './types'

type ValidatedRow = OrderDetailCmuRow & { rowNumber: number }
const IMPORT_LABEL = 'Order Details (CMU)'

export async function importOrderDetailsCmuCsv(formData: FormData): Promise<ImportResult> {
  const file = formData.get('file') as File | null
  if (!file) {
    return {
      totalRows: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 1,
      errors: [{ rowNumber: 0, raw: {}, reason: 'No file provided' }],
      skippedRows: [],
    }
  }

  const text = await file.text()
  const { rows, headers } = parseCsvText(text)

  const headerError = checkRequiredHeaders(headers, REQUIRED_HEADERS, IMPORT_LABEL)
  if (headerError) {
    return {
      totalRows: rows.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: rows.length,
      errors: [{ rowNumber: 0, raw: {}, reason: headerError }],
      skippedRows: [],
    }
  }

  const supabase = await createClient()

  // Same location_options view every other import type validates
  // against -- one Location enum, shared everywhere.
  const { data: locationRows, error: locationError } = await supabase.from('location_options').select('location')
  if (locationError) {
    return {
      totalRows: rows.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: rows.length,
      errors: [{ rowNumber: 0, raw: {}, reason: `Could not load location reference data (location_options): ${locationError.message}` }],
      skippedRows: [],
    }
  }
  const validLocations = new Set((locationRows ?? []).map((r) => String(r.location).toLowerCase()))

  const validRows: ValidatedRow[] = []
  const errors: RowError[] = []

  rows.forEach((raw, i) => {
    const rowNumber = i + 2
    const result = validateRow(raw, rowNumber, validLocations)
    if (result.error) errors.push(result.error)
    else validRows.push({ ...result.row, rowNumber })
  })

  if (validRows.length === 0) {
    return { totalRows: rows.length, inserted: 0, updated: 0, skipped: 0, failed: errors.length, errors, skippedRows: [] }
  }

  // Order Id is high-cardinality (one distinct value per row, like
  // Square's Transaction ID) and already the table's own primary key, so
  // a plain existence check is all the dedup needs -- no composite key,
  // no fetchExistingRows(). fetchExistingKeys() batches the .in() so the
  // request URL can't grow unbounded with file size the way it did the
  // first time Transaction Details (Square) tried a plain .in() call.
  const orderIds = validRows.map((r) => r.orderId)
  let existingOrderIds: Set<string>
  try {
    existingOrderIds = await fetchExistingKeys(supabase, 'order_details_cmu', 'order_id', orderIds)
  } catch (lookupError) {
    return {
      totalRows: rows.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: rows.length,
      errors: [{ rowNumber: 0, raw: {}, reason: `Lookup failed: ${(lookupError as Error).message}` }],
      skippedRows: [],
    }
  }

  // existingByKey maps Order Id -> Order Id here, not a separate
  // synthetic id -- there isn't one. Kept as a string on both sides of
  // the map, not Number(...)'d, per this guide's notes on bigint
  // precision.
  const existingByKey = new Map<string, string>(
    [...existingOrderIds].map((id) => [id, id])
  )

  const { toInsert, skipped, errors: splitErrors } = splitInsertsAndUpdates(
    validRows.map((row) => ({ data: row, rowNumber: row.rowNumber })),
    (row: ValidatedRow) => row.orderId,
    existingByKey,
    (row: ValidatedRow) => ({
      'Order Id': row.orderId,
      'Date & Time': row.dateTime,
      Type: row.type,
      'Customer Name': row.customerName,
      Campus: row.campus,
      Venue: row.venue,
      Status: row.status,
      'Total ($)': row.total,
    }),
    (rowNumbers) =>
      `Duplicate within this file: rows ${rowNumbers.join(', ')} share the same Order Id — none were imported. Fix or remove the duplicates and re-upload.`,
    { onExistingMatch: 'skip' }
  )

  // Inserting against the base table directly, with its real
  // spaced/parenthesized column names as the record's keys -- same
  // reasoning as End of Day 86+Waste's Step 7: PostgREST's "a dot/space
  // means something special" parsing only applies to query-string
  // parameters on a GET-shaped request, not an .insert()'s JSON body, so
  // there's no need to route through order_details_cmu's clean aliases
  // just to write a record. Note `toRecord` above never sets "Location"
  // -- it's a GENERATED ALWAYS column (Step 2), and Postgres rejects any
  // insert that tries to set one directly.
  const insertResult = await insertRows(supabase, 'Order Details-CMU', toInsert)

  return {
    totalRows: rows.length,
    inserted: insertResult.succeeded,
    updated: 0,
    skipped: skipped.length,
    failed: errors.length + splitErrors.length + insertResult.errors.length,
    errors: [...errors, ...splitErrors, ...insertResult.errors],
    skippedRows: skipped,
  }
}