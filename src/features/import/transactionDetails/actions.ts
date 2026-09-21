'use server'

import { createClient } from '@/lib/supabase/server'
import { parseCsvText } from '../shared/parseCsv'
import { checkRequiredHeaders } from '../shared/validateHeaders'
import { insertRows } from '../shared/batchWrite'
import type { ImportResult, RowError } from '../shared/types'
import { validateRow, REQUIRED_HEADERS } from './validation'
import type { TransactionDetailRow } from './types'
import { fetchExistingKeys } from '../shared/fetchExistingKeys'

type ValidatedRow = TransactionDetailRow & { rowNumber: number }

const IMPORT_LABEL = 'Transaction Details (Square)'

export async function importTransactionDetailsCsv(formData: FormData): Promise<ImportResult> {
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

  // Reuses the SAME location_options view built for Timesheet — one
  // Location enum, shared by every import type that needs to validate
  // against it. No separate mapping table here, unlike Deputy's.
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

   // Which of this file's Transaction IDs already exist in the database?
  // Batched via fetchExistingKeys() instead of one .in() call — see the
  // shared helper and this guide's notes on why a big single request
  // fails with a bare "Bad Request" on a real multi-thousand-row file.
  let alreadyImported: Set<string>
  try {
    alreadyImported = await fetchExistingKeys(
      supabase,
      'transaction_details',
      'transaction_id',
      validRows.map((r) => r.transactionId)
    )
  } catch (lookupError) {
    console.error('Transaction Details lookup error:', lookupError)
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

  const toInsert: { record: Record<string, unknown>; rowNumber: number }[] = []
  const skipped: RowError[] = []

  for (const row of validRows) {
    if (alreadyImported.has(row.transactionId)) {
      // Every line of this transaction is skipped, not just ones that
      // happen to look like an existing row -- the whole order was
      // already imported, or none of it should be.
      skipped.push({
        rowNumber: row.rowNumber,
        raw: {},
        reason: `Transaction ${row.transactionId} is already in the database — skipped, not re-imported.`,
      })
      continue
    }

    toInsert.push({
      record: {
        date: row.date,
        time: row.time,
        time_zone: row.timeZone,
        category: row.category,
        item: row.item,
        qty: row.qty,
        price_point_name: row.pricePointName,
        sku: row.sku,
        modifiers_applied: row.modifiersApplied,
        gross_sales: row.grossSales,
        discounts: row.discounts,
        net_sales: row.netSales,
        tax: row.tax,
        transaction_id: row.transactionId,
        payment_id: row.paymentId,
        device_name: row.deviceName,
        notes: row.notes,
        details: row.details,
        event_type: row.eventType,
        location: row.location,
        dining_option: row.diningOption,
        customer_id: row.customerId,
        customer_name: row.customerName,
        customer_reference_id: row.customerReferenceId,
        unit: row.unit,
        count: row.count,
        gtin: row.gtin,
        itemization_type: row.itemizationType,
        fulfillment_note: row.fulfillmentNote,
        channel: row.channel,
        token: row.token,
        card_brand: row.cardBrand,
        pan_suffix: row.panSuffix,
      },
      rowNumber: row.rowNumber,
    })
  }

  const insertResult = await insertRows(supabase, 'transaction_details', toInsert)
  errors.push(...insertResult.errors)

  return {
    totalRows: rows.length,
    inserted: insertResult.succeeded,
    updated: 0, // this import never updates an existing row — see the guide's decisions
    skipped: skipped.length,
    failed: errors.length,
    errors,
    skippedRows: skipped,
  }
}