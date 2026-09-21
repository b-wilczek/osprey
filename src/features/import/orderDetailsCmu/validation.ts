import type { RowError } from '../shared/types'
import type { OrderDetailCmuRow } from './types'

export const REQUIRED_HEADERS = ['Order Id', 'Date & Time', 'Venue'] as const

// Same two Grubhub OneView venues, same mapping, as Transaction Details
// (CMU)'s validation.ts -- these have to be kept in sync by hand, since
// the database's generated `Location` column (Step 2) is an independent
// hardcoded copy of this same mapping and can't reference this map, or
// vice versa. Add a line here (and to Step 2's generated-column
// expression) if a third CMU venue ever comes online.
//
// NOTE the trailing space on "Hunt Library " below -- that's not a typo,
// see Transaction Details (CMU)'s guide for how this was confirmed
// against real data (0 rows without the space, 35,000+ with it).
const VENUE_TO_LOCATION: Record<string, string> = {
  'De Fer Coffee & Tea - Resnik': 'CMU-Resnik',
  'De Fer Coffee & Tea - Hunt Library ': 'CMU-Hunt',
}

// Real export format, confirmed directly against a sample row:
// "2026/01/31 - 12:56:28" -- YYYY/MM/DD - HH:MM:SS, NOT ISO. `Date &
// Time` is a real Postgres `timestamp without time zone` column, so
// leaving this unparsed is what produced the "2026-01-31 00:00:00"
// result seen testing a direct Supabase import -- Postgres's parser
// didn't recognize the " - " separator and silently fell back to
// midnight rather than erroring. Converting to ISO here avoids that
// entirely, and avoids the same raw-string-vs-database's-canonical-
// string mismatch that broke Transaction Details (CMU) and End of Day
// 86+Waste's dedup if this were ever used as part of a key later.
function toIsoTimestamp(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{4})\/(\d{2})\/(\d{2})\s*-\s*(\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return trimmed // already ISO, or unrecognized -- let downstream validation/the database catch it
  const [, y, m, d, hh, mm, ss] = match
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const n = Number(value.trim().replace(/[$,]/g, ''))
  return Number.isNaN(n) ? null : n
}

// Everything outside REQUIRED_HEADERS is optional pass-through -- blank
// means null, not an error.
function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function validateRow(
  raw: Record<string, string>,
  rowNumber: number,
  validLocations: Set<string>
): { row: OrderDetailCmuRow; error: null } | { row: null; error: RowError } {
  const missing = REQUIRED_HEADERS.filter((h) => !raw[h]?.trim())
  if (missing.length > 0) {
    return {
      row: null,
      error: { rowNumber, raw, reason: `Missing required field(s): ${missing.join(', ')}` },
    }
  }

  // Same reasoning as Transaction Details (CMU): don't trim Venue before
  // this lookup, or a real trailing space on "Hunt Library " silently
  // stops matching both this map and the database's generated Location
  // expression.
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

  return {
    row: {
      orderId: raw['Order Id'].trim(), // kept as a string -- see this guide's notes on bigint precision
      dateTime: toIsoTimestamp(raw['Date & Time']),
      type: optionalText(raw['Type']),
      customerName: optionalText(raw['Customer Name']),
      campus: optionalText(raw['Campus']),
      venue, // deliberately not trimmed -- see this guide's notes
      status: optionalText(raw['Status']),
      total: parseNumber(raw['Total ($)']),
      location,
    },
    error: null,
  }
}