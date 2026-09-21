import type { RowError } from '../shared/types'
import type { TransactionDetailCmuRow } from './types'

export const REQUIRED_HEADERS = ['Order Date', 'Venue', 'Item'] as const

// Only two Grubhub OneView venues exist today — hardcoded rather than a
// mapping table (see this guide's notes above). Add a line here by hand
// if a third CMU venue ever comes online.
//
// NOTE the trailing space on "Hunt Library " below — that's not a typo.
// Grubhub's real export consistently emits this Venue with a trailing
// space (confirmed against real data: 0 rows without it, 35,000+ with
// it), and the database's generated `Location` column was written
// against that real value. Don't "clean up" this key.
const VENUE_TO_LOCATION: Record<string, string> = {
  'De Fer Coffee & Tea - Resnik': 'CMU-Resnik',
  'De Fer Coffee & Tea - Hunt Library ': 'CMU-Hunt',
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const n = Number(value.trim().replace(/[$,%]/g, ''))
  return Number.isNaN(n) ? null : n
}

// Grubhub OneView's real export writes Order Date as MM-DD-YY (e.g.
// "07-30-26") — confirmed by opening a real file directly, not
// ISO/YYYY-MM-DD as this guide originally assumed. `order_date` is a
// genuine Postgres `date` column, so an insert of "07-30-26" is parsed
// and stored correctly regardless of the string's shape — but every
// SELECT hands the value back as canonical ISO ("2026-07-30"). If the
// app kept using Grubhub's raw MM-DD-YY string for its own key logic,
// every existing-row comparison would compare that raw string against
// the ISO string a freshly-read database row returns for the identical
// calendar day — two different strings, same real date, never matching.
// Converting to ISO here, once, up front, means the app's own
// `orderDate` always looks exactly like what a round-tripped database
// value looks like, everywhere it's used downstream (the key, the
// `.in()` filter, and the inserted record itself).
function toIsoDate(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{2})-(\d{2})-(\d{2})$/)
  if (!match) return trimmed // already ISO, or unrecognized -- let downstream validation/the database catch it
  const [, mm, dd, yy] = match
  // Grubhub's 2-digit years are all recent/current data -- safe to
  // assume 20XX. Revisit if this import is ever still running in 2070.
  return `20${yy}-${mm}-${dd}`
}

// Everything outside REQUIRED_HEADERS is optional pass-through — blank
// means null, not an error.
function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function validateRow(
  raw: Record<string, string>,
  rowNumber: number,
  validLocations: Set<string>
): { row: TransactionDetailCmuRow; error: null } | { row: null; error: RowError } {
  const missing = REQUIRED_HEADERS.filter((h) => !raw[h]?.trim())
  if (missing.length > 0) {
    return {
      row: null,
      error: { rowNumber, raw, reason: `Missing required field(s): ${missing.join(', ')}` },
    }
  }

  // Deliberately NOT trimmed — see the note above VENUE_TO_LOCATION.
  // Grubhub's real "Hunt Library" Venue value has a real trailing space,
  // and trimming it here would silently mismatch both this map and the
  // database's generated Location expression, which both expect it.
  const venue = raw['Venue']
  const location = VENUE_TO_LOCATION[venue]
  if (!location) {
    return {
      row: null,
      error: { rowNumber, raw, reason: `"${venue}" isn't a recognized CMU Venue — check VENUE_TO_LOCATION in validation.ts` },
    }
  }
  if (!validLocations.has(location.toLowerCase())) {
    return {
      row: null,
      error: { rowNumber, raw, reason: `Mapped Location "${location}" isn't in location_options — check the Location enum` },
    }
  }

  const percentQuantity = parseNumber(raw['% Quantity'])

  return {
    row: {
      orderDate: toIsoDate(raw['Order Date']),
      timeInterval: optionalText(raw['Time Interval']),
      campus: optionalText(raw['Campus']),
      venue,
      category: optionalText(raw['Category']),
      item: raw['Item'].trim(),
      modifierGroup: optionalText(raw['Modifier Group']),
      modifier: optionalText(raw['Modifier']),
      quantity: parseNumber(raw['Quantity']),
      percentQuantity,
      salePrice: parseNumber(raw['Sale Price']),
      subtotalSalePrice: parseNumber(raw['Subtotal Sale Price']),
      merchantDiscount: parseNumber(raw['Merchant Discount']),
      totalMerchantSale: parseNumber(raw['Total Merchant Sale']),
      location,
    },
    error: null,
  }
}