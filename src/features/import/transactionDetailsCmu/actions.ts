'use server'

import { createClient } from '@/lib/supabase/server'
import { parseCsvText } from '../shared/parseCsv'
import { checkRequiredHeaders } from '../shared/validateHeaders'
import { splitInsertsAndUpdates } from '../shared/splitInsertsAndUpdates'
import { insertRows } from '../shared/batchWrite'
import type { ImportResult, RowError } from '../shared/types'
import { validateRow, REQUIRED_HEADERS } from './validation'
import type { TransactionDetailCmuRow } from './types'

type ValidatedRow = TransactionDetailCmuRow & { rowNumber: number }

const IMPORT_LABEL = 'Transaction Details (CMU)'

// Open Item is CMU's catch-all bucket (a typed-in price per instance) —
// see this guide's notes above for why it can't go through the same
// per-row key as everything else.
function isOpenItem(category: string | null, item: string): boolean {
  return category === 'Open items' && item === 'Open item'
}

export async function importTransactionDetailsCmuCsv(formData: FormData): Promise<ImportResult> {
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

  // Grubhub computes a MODIFIER row's % Quantity against each
  // co-occurring TOTAL row's own quantity as the denominator, so the
  // same modifier line gets emitted once per denominator -- identical to
  // its twin on every column except % Quantity. That's a raw mechanical
  // artifact (values over 100% are the tell), not a duplicate sale, so
  // it's collapsed here rather than treated as a natural-key violation.
  // Row numbers are computed BEFORE collapsing, so error/skip reporting
  // always points at the row's real position in the original file.
  const seenRawKeys = new Map<string, number>() // key -> first rowNumber that had it
  const dedupedRows: { raw: Record<string, string>; rowNumber: number }[] = []
  const artifactSkips: RowError[] = []
  rows.forEach((raw, i) => {
    const rowNumber = i + 2
    const key = Object.keys(raw)
      .filter((h) => h !== '% Quantity')
      .sort()
      .map((h) => `${h}=${raw[h]}`)
      .join('|')
    const firstRowNumber = seenRawKeys.get(key)
    if (firstRowNumber !== undefined) {
      artifactSkips.push({
        rowNumber,
        raw,
        reason: `Identical to row ${firstRowNumber} except % Quantity — Grubhub's reporting artifact, not a separate sale.`,
      })
      return
    }
    seenRawKeys.set(key, rowNumber)
    dedupedRows.push({ raw, rowNumber })
  })

  const supabase = await createClient()

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

  dedupedRows.forEach(({ raw, rowNumber }) => {
    const result = validateRow(raw, rowNumber, validLocations)
    if (result.error) errors.push(result.error)
    else validRows.push({ ...result.row, rowNumber })
  })

  if (validRows.length === 0) {
    return {
      totalRows: rows.length,
      inserted: 0,
      updated: 0,
      skipped: artifactSkips.length,
      failed: errors.length,
      errors,
      skippedRows: artifactSkips,
    }
  }

  // One lookup covers both dedup strategies -- scoped by Order Date,
  // which keeps the WHERE clause small no matter how big a file gets
  // (see this guide's notes on why fetchExistingKeys() isn't needed
  // here for the WHERE side). But the number of dates in the file has
  // nothing to do with the number of rows that come BACK -- once this
  // table has accumulated enough history for those same dates, a single
  // .select() can hit Supabase's default cap of 1000 rows per response.
  // Past that cap PostgREST doesn't error, it just silently truncates,
  // so this has to be paged with .range() rather than trusted to return
  // everything in one call -- see this guide's notes above.
  // NOTE the measure columns are typed `string | number | null`, not
  // `number | null` -- PostgREST returns Postgres `numeric` columns as
  // JSON strings (e.g. "0.00"), not JSON numbers, specifically to avoid
  // silently losing precision converting to a JS double. Sale Price,
  // Subtotal Sale Price, Merchant Discount, and Total Merchant Sale are
  // near-certainly `numeric` on this table, so treat all four as
  // possibly-string here. See the note below at `existingByKey` for why
  // this isn't just a type-safety nicety.
  type ExistingCmuRow = {
    line_id: number
    order_date: string
    time_interval: string | null
    campus: string | null
    venue: string
    category: string | null
    item: string
    modifier_group: string | null
    modifier: string | null
    quantity: string | number | null
    sale_price: string | number | null
    subtotal_sale_price: string | number | null
    merchant_discount: string | number | null
    total_merchant_sale: string | number | null
  }

  // .order('line_id') is required, not cosmetic -- .range() pages are
  // only guaranteed non-overlapping and gap-free against a stable sort.
  // Without an explicit order, Postgres is free to return rows in a
  // different sequence per page (or per query), which would silently
  // drop or duplicate rows across pages instead of paginating correctly.
  const dates = [...new Set(validRows.map((r) => r.orderDate))]
  const existingRows: ExistingCmuRow[] = []
  const PAGE_SIZE = 1000
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data: page, error: lookupError } = await supabase
      .from('transaction_details_cmu')
      .select(
        'line_id, order_date, time_interval, campus, venue, category, item, modifier_group, modifier, quantity, sale_price, subtotal_sale_price, merchant_discount, total_merchant_sale'
      )
      .in('order_date', dates)
      .order('line_id', { ascending: true })
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

    existingRows.push(...(page ?? []))
    if (!page || page.length < PAGE_SIZE) break
  }

  // The 13-column key for regular items -- one keyOf reused for both the
  // existing-row map and the split call, same pattern as Timesheet's
  // actions.ts.
  const keyOf = (r: {
    orderDate: string
    timeInterval: string | null
    campus: string | null
    venue: string
    category: string | null
    item: string
    modifierGroup: string | null
    modifier: string | null
    quantity: number | null
    salePrice: number | null
    subtotalSalePrice: number | null
    merchantDiscount: number | null
    totalMerchantSale: number | null
  }) =>
    [
      r.orderDate,
      r.timeInterval ?? '',
      r.campus ?? '',
      r.venue,
      r.category ?? '',
      r.item,
      r.modifierGroup ?? '',
      r.modifier ?? '',
      r.quantity ?? '',
      r.salePrice ?? '',
      r.subtotalSalePrice ?? '',
      r.merchantDiscount ?? '',
      r.totalMerchantSale ?? '',
    ].join('|')

  // The coarse key for Open Item -- Order Date + Venue + Category + Total
  // Merchant Sale, per this guide's notes on why Open Item can't use the
  // per-row key above.
  const openItemKeyOf = (r: { orderDate: string; venue: string; category: string | null; totalMerchantSale: number | null }) =>
    [r.orderDate, r.venue, r.category ?? '', r.totalMerchantSale ?? ''].join('|')

  // Postgres `numeric` columns round-trip through PostgREST as strings
  // ("0.00", "12.00"), while validateRow() parses the same values into
  // plain JS numbers (0, 12) via parseNumber(). keyOf just joins whatever
  // it's given, so without this normalization the two sides of the same
  // comparison stringify differently for any row with a numeric field --
  // "0.00" from the database never equals "0" from the app -- and the
  // existing-row map ends up matching almost nothing even when the row
  // really is already there. Both sides have to go through the same
  // Number(...) coercion before they're joined into a key.
  const toNum = (v: string | number | null): number | null => (v === null ? null : Number(v))

  const existingByKey = new Map<string, number>()
  const existingOpenItemKeys = new Set<string>()
  for (const row of existingRows) {
    if (isOpenItem(row.category, row.item)) {
      existingOpenItemKeys.add(
        openItemKeyOf({ orderDate: row.order_date, venue: row.venue, category: row.category, totalMerchantSale: toNum(row.total_merchant_sale) })
      )
      continue
    }
    existingByKey.set(
      keyOf({
        orderDate: row.order_date,
        timeInterval: row.time_interval,
        campus: row.campus,
        venue: row.venue,
        category: row.category,
        item: row.item,
        modifierGroup: row.modifier_group,
        modifier: row.modifier,
        quantity: toNum(row.quantity),
        salePrice: toNum(row.sale_price),
        subtotalSalePrice: toNum(row.subtotal_sale_price),
        merchantDiscount: toNum(row.merchant_discount),
        totalMerchantSale: toNum(row.total_merchant_sale),
      }),
      row.line_id
    )
  }

  // row_data_type is deliberately absent here -- it's a GENERATED ALWAYS
  // AS (...) STORED column on the base table, derived by Postgres itself
  // from percent_quantity. Including any value for it, even the "right"
  // one, makes Postgres reject the whole insert with "cannot insert a
  // non-DEFAULT value into column "row_data_type"". Location is ALSO a
  // GENERATED ALWAYS AS (...) STORED column (derived from Venue) — same
  // rejection, same fix: it's absent here too. validateRow() still
  // computes and checks `location` (see Step 6) purely as a pre-insert
  // sanity check against location_options; that computed value is just
  // never sent to the database.
  const toRecord = (row: ValidatedRow) => ({
    order_date: row.orderDate,
    time_interval: row.timeInterval,
    campus: row.campus,
    venue: row.venue,
    category: row.category,
    item: row.item,
    modifier_group: row.modifierGroup,
    modifier: row.modifier,
    quantity: row.quantity,
    percent_quantity: row.percentQuantity,
    sale_price: row.salePrice,
    subtotal_sale_price: row.subtotalSalePrice,
    merchant_discount: row.merchantDiscount,
    total_merchant_sale: row.totalMerchantSale,
  })

  const regularRows = validRows.filter((r) => !isOpenItem(r.category, r.item))
  const openItemRows = validRows.filter((r) => isOpenItem(r.category, r.item))

  // Regular items: the framework's usual natural-key grouping, now on 13
  // columns instead of 8.
  const {
    toInsert: regularToInsert,
    skipped: regularSkipped,
    errors: dupErrors,
  } = splitInsertsAndUpdates(
    regularRows.map((row) => ({ data: row, rowNumber: row.rowNumber })),
    keyOf,
    existingByKey,
    toRecord,
    (rowNumbers) => `Duplicate row within this file (same 13-column combination as row(s) ${rowNumbers.join(', ')}) — check for an accidental repeat.`,
    {
      onExistingMatch: 'skip',
      skipReason: (existingId) => `Already imported (matches existing row ${existingId}) — skipped, not re-imported.`,
    }
  )
  errors.push(...dupErrors)

  // Open Item: no natural key, no intra-file duplicate check -- every row
  // sharing a NEW coarse key is inserted together, repeats included;
  // every row sharing an ALREADY-IMPORTED coarse key is skipped together.
  const openItemToInsert: { record: Record<string, unknown>; rowNumber: number }[] = []
  const openItemSkipped: RowError[] = []
  for (const row of openItemRows) {
    const key = openItemKeyOf(row)
    if (existingOpenItemKeys.has(key)) {
      openItemSkipped.push({
        rowNumber: row.rowNumber,
        raw: {},
        reason:
          'Open Item already imported for this Order Date/Venue/Category/Total Merchant Sale combination — skipped, not re-imported (no per-row check within this group; see this guide\'s notes).',
      })
      continue
    }
    openItemToInsert.push({ record: toRecord(row), rowNumber: row.rowNumber })
  }

  const toInsert = [...regularToInsert, ...openItemToInsert]
  const skipped = [...artifactSkips, ...regularSkipped, ...openItemSkipped]

  const insertResult = await insertRows(supabase, 'transaction_details_cmu', toInsert)
  errors.push(...insertResult.errors)

  return {
    totalRows: rows.length,
    inserted: insertResult.succeeded,
    updated: 0, // onExistingMatch: 'skip' means this never happens, and Open Item never updates either
    skipped: skipped.length,
    failed: errors.length,
    errors,
    skippedRows: skipped,
  }
}