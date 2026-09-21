'use server'

import { createClient } from '@/lib/supabase/server'
import { parseCsvText } from '../shared/parseCsv'
import { checkRequiredHeaders } from '../shared/validateHeaders'
import { splitInsertsAndUpdates } from '../shared/splitInsertsAndUpdates'
import { insertRows } from '../shared/batchWrite'
import { fetchExistingRows } from '../shared/fetchExistingRows'
import type { ImportResult, RowError } from '../shared/types'
import { validateRow, REQUIRED_HEADERS } from './validation'
import type { EodWasteRow } from './types'

type ValidatedRow = EodWasteRow & { rowNumber: number }
const IMPORT_LABEL = 'End of Day 86+Waste'

type ExistingEodWasteRow = {
  line_id: number
  submitted_at: string
  location: string
  item_name: string
}

export async function importEodWasteCsv(formData: FormData): Promise<ImportResult> {
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
  // against -- one enum, shared everywhere.
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

  // Timestamp is the key's high-cardinality leading column (roughly one
  // distinct value per real submission, not a small bounded set like a
  // calendar date) -- fetchExistingRows() batches the .in() AND pages
  // each batch's response, since a batch of 200 timestamps can easily
  // match well over 1,000 rows once each submission's several items are
  // counted. See the CSV Import Framework guide's Playbook and
  // shared/fetchExistingRows.ts for why fetchExistingKeys() alone isn't
  // enough here -- this needs the full rows back, not just a Set.
  const timestamps = [...new Set(validRows.map((r) => r.submittedAt))]
  let existingRows: ExistingEodWasteRow[]
  try {
    existingRows = await fetchExistingRows<ExistingEodWasteRow>(
      supabase,
      'waste_data',
      'submitted_at',
      timestamps,
      'line_id, submitted_at, location, item_name',
      'line_id'
    )
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

  const keyOf = (r: { submittedAt: string; location: string; itemName: string }) =>
    [r.submittedAt, r.location, r.itemName].join('|')

  const existingByKey = new Map<string, number>()
  for (const row of existingRows) {
    existingByKey.set(
      keyOf({ submittedAt: row.submitted_at, location: row.location, itemName: row.item_name }),
      row.line_id
    )
  }

  const { toInsert, skipped, errors: splitErrors } = splitInsertsAndUpdates(
    validRows.map((row) => ({ data: row, rowNumber: row.rowNumber })),
    keyOf,
    existingByKey,
    (row: ValidatedRow) => ({
      timestamp: row.submittedAt,
      reportForDate: row.reportDate,
      userEmail: row.userEmail,
      'formData.userName': row.userName,
      'formData.location': row.location,
      'item.name': row.itemName,
      'item.wasteAmount': row.wasteAmount,
      'item.is86ed': row.is86ed,
      'item.timeOut': row.timeOut,
      'formData.notes': row.notes,
      'formData.noFoodWasteToday': row.noFoodWasteToday,
      'formData.no86sToday': row.no86sToday,
    }),
    (rowNumbers) =>
      `Duplicate within this file: rows ${rowNumbers.join(', ')} share the same Timestamp/Location/Item Name combination — none were imported. Fix or remove the duplicates and re-upload.`,
    { onExistingMatch: 'skip' }
  )

  // Inserting through the base table's real (dotted) column names here,
  // not the waste_data view -- the view's aliases are for reading, the
  // insert targets the columns splitInsertsAndUpdates' toRecord above
  // just built records for.
  const insertResult = await insertRows(supabase, 'End of Day 86+Waste Data', toInsert)

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