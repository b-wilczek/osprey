'use server'

import { createClient } from '@/lib/supabase/server'
import { parseCsvText } from '../shared/parseCsv'
import { checkRequiredHeaders } from '../shared/validateHeaders'
import { splitInsertsAndUpdates } from '../shared/splitInsertsAndUpdates'
import { insertRows, upsertRows } from '../shared/batchWrite'
import type { ImportResult, RowError } from '../shared/types'
import { validateRow, REQUIRED_HEADERS, type LocationLookup } from './validation'
import type { TimesheetRow } from './types'

// A validated row, still carrying the CSV row number it came from — needed
// so that duplicate-key and per-row DB errors further down can point back
// at a real line in the file instead of reporting rowNumber: 0.
type ValidatedRow = TimesheetRow & { rowNumber: number }

const IMPORT_LABEL = 'Timesheet Data'

export async function importTimesheetCsv(formData: FormData): Promise<ImportResult> {
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

  // Catches "wrong dropdown option selected" as one clear error instead
  // of hundreds of individual "missing required field" row errors.
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

  const [locationResult, mappingResult] = await Promise.all([
    supabase.from('location_options').select('location'),
    supabase.from('location_mapping').select('deputy_name, common_location_name'),
  ])

  // Fail loudly here rather than silently treating a broken lookup as
  // "zero valid locations" — that failure mode looks identical to every
  // row having a bad location, which is confusing to debug (this is
  // exactly what happened during testing: an unreachable location_options
  // view made every row fail with "not a recognized Location value," even
  // rows using genuinely correct locations).
  if (locationResult.error || mappingResult.error) {
    const message = locationResult.error?.message ?? mappingResult.error?.message
    return {
      totalRows: rows.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: rows.length,
      errors: [
        {
          rowNumber: 0,
          raw: {},
          reason: `Could not load location reference data (location_options/location_mapping): ${message}`,
        },
      ],
      skippedRows: [],
    }
  }

  const validLocations = new Set(
    (locationResult.data ?? []).map((r) => String(r.location).toLowerCase())
  )

  const lookup: LocationLookup = { byDeputyName: new Map(), forBlank: null }
  for (const row of mappingResult.data ?? []) {
    if (row.deputy_name === null) {
      lookup.forBlank = row.common_location_name
    } else {
      lookup.byDeputyName.set(String(row.deputy_name).trim().toLowerCase(), row.common_location_name)
    }
  }

  const validRows: ValidatedRow[] = []
  const errors: RowError[] = []

  rows.forEach((raw, i) => {
    // +2: row 1 is the header, so the first data row is row 2 in the file
    const rowNumber = i + 2
    const result = validateRow(raw, rowNumber, lookup, validLocations)
    if (result.error) errors.push(result.error)
    else validRows.push({ ...result.row, rowNumber })
  })

  if (validRows.length === 0) {
    return { totalRows: rows.length, inserted: 0, updated: 0, skipped: 0, failed: errors.length, errors, skippedRows: [] }
  }

  // Look up existing rows for the dates in this file, to tell inserts from updates.
  // Includes is_leave — it's part of the natural key now, alongside
  // display_name/timesheet_date/start_time/end_time.
  //
  // Paged with .range() rather than one plain .in() call — a date-scoped
  // key keeps the request URL small, but says nothing about how many
  // rows that date range can accumulate once the table has real history
  // behind it, and Supabase/PostgREST silently caps a response at 1,000
  // rows with no error. Past that cap this map would quietly go missing
  // real existing rows, which surfaces as a genuine
  // `duplicate key value violates unique constraint` error on rows the
  // app wrongly thought were new — exactly what happened to Transaction
  // Details (CMU)'s identical pattern on its first real multi-thousand-row
  // upload against an already-populated table (see the CSV Import
  // Framework guide's Playbook and that guide's Step 7/Design history).
  // .order('unique_id') is required, not cosmetic — .range() pages are
  // only guaranteed non-overlapping and gap-free against a stable sort.
  type ExistingTimesheetRow = {
    unique_id: number
    display_name: string
    timesheet_date: string
    start_time: string
    end_time: string
    is_leave: boolean
  }
  const dates = [...new Set(validRows.map((r) => r.timesheetDate))]
  const existing: ExistingTimesheetRow[] = []
  const PAGE_SIZE = 1000
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data: page, error: lookupError } = await supabase
      .from('timesheet_data')
      .select('unique_id, display_name, timesheet_date, start_time, end_time, is_leave')
      .in('timesheet_date', dates)
      .order('unique_id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (lookupError) {
      return {
        totalRows: rows.length,
        inserted: 0,
        updated: 0,
        skipped: 0,
        failed: rows.length,
        errors: [{ rowNumber: 0, raw: {}, reason: `Lookup failed: ${lookupError.message}` }],
        skippedRows: [],
      }
    }

    existing.push(...(page ?? []))
    if (!page || page.length < PAGE_SIZE) break
  }

  const keyOf = (r: {
    displayName: string
    timesheetDate: string
    startTime: string
    endTime: string
    isLeave: boolean
  }) => `${r.displayName}|${r.timesheetDate}|${r.startTime}|${r.endTime}|${r.isLeave}`

  const existingByKey = new Map<string, number>()
  for (const row of existing) {
    existingByKey.set(
      keyOf({
        displayName: row.display_name,
        timesheetDate: row.timesheet_date,
        startTime: row.start_time,
        endTime: row.end_time,
        isLeave: row.is_leave,
      }),
      row.unique_id
    )
  }

  // Groups this file's own rows by natural key (catching intra-file
  // duplicates), splits the rest into inserts vs. updates against the
  // existing-rows map above — see the CSV Import Framework guide for what
  // this closes off (the real bug hit on a 2206-row import).
  const { toInsert, toUpdate, errors: splitErrors } = splitInsertsAndUpdates(
    validRows.map((row) => ({ data: row, rowNumber: row.rowNumber })),
    keyOf,
    existingByKey,
    (row, existingId) => {
      const record: Record<string, unknown> = {
        display_name: row.displayName,
        timesheet_date: row.timesheetDate,
        start_time: row.startTime,
        end_time: row.endTime,
        total_hours: row.totalHours,
        cost: row.cost,
        location: row.location,
        is_leave: row.isLeave,
      }
      if (existingId) record.unique_id = existingId
      return record
    },
    (rowNumbers) =>
      `Duplicate within this file: rows ${rowNumbers.join(', ')} share the same Display Name/Date/Start/End/Leave? combination — none were imported. Fix or remove the duplicates and re-upload.`
  )
  errors.push(...splitErrors)

  const insertResult = await insertRows(supabase, 'timesheet_data', toInsert)
  const updateResult = await upsertRows(supabase, 'timesheet_data', toUpdate, 'unique_id')
  errors.push(...insertResult.errors, ...updateResult.errors)

  return {
    totalRows: rows.length,
    inserted: insertResult.succeeded,
    updated: updateResult.succeeded,
    skipped: 0, // Timesheet always upserts on a natural-key match, never skips — see the CSV Import Framework guide's onExistingMatch option
    failed: errors.length,
    errors,
    skippedRows: [],
  }
}