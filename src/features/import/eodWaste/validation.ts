import type { RowError } from '../shared/types'
import type { EodWasteRow } from './types'

export const REQUIRED_HEADERS = ['timestamp', 'reportForDate', 'formData.location', 'item.name'] as const

// Real export format, confirmed directly against a sample cell:
// "8/16/2026 17:28:13" -- M/D/YYYY HH:MM:SS, 24-hour, NOT ISO. `timestamp`
// is a real Postgres `timestamp without time zone` column, so an insert
// of this raw string is parsed and stored correctly regardless of shape
// -- but every SELECT hands it back as canonical ISO
// ("2026-08-16T17:28:13"). If the app kept using the raw M/D/YYYY string
// for its own key logic, every existing-row comparison would compare
// that raw string against the ISO string a freshly-read database row
// returns for the identical instant -- two different strings, same real
// value, never matching. This is exactly the bug that broke Transaction
// Details (CMU)'s dedup almost entirely; converting up front here avoids
// rediscovering it a third time.
function toIsoTimestamp(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/)
  if (!match) return trimmed // already ISO, or unrecognized -- let downstream validation/the database catch it
  const [, m, d, y, hh, mm, ss] = match
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${hh.padStart(2, '0')}:${mm}:${ss}`
}

// Real export format, confirmed directly: "8/16/2026" -- M/D/YYYY, NOT
// ISO. Same reasoning as toIsoTimestamp() above, for the `reportForDate`
// column (a real Postgres `date` column).
function toIsoDate(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return trimmed
  const [, m, d, y] = match
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const n = Number(value.trim())
  return Number.isNaN(n) ? null : n
}

// Handles TRUE/FALSE, true/false, and blank (treated as false) --
// adjust here if a real export uses something else (e.g. "Yes"/"No").
function parseBoolean(value: string | undefined): boolean {
  return value?.trim().toUpperCase() === 'TRUE'
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
): { row: EodWasteRow; error: null } | { row: null; error: RowError } {
  const missing = REQUIRED_HEADERS.filter((h) => !raw[h]?.trim())
  if (missing.length > 0) {
    return {
      row: null,
      error: { rowNumber, raw, reason: `Missing required field(s): ${missing.join(', ')}` },
    }
  }

  // No translation needed -- see this guide's notes on why
  // formData.location is assumed to already match the Location enum.
  const location = raw['formData.location'].trim()
  if (!validLocations.has(location.toLowerCase())) {
    return {
      row: null,
      error: { rowNumber, raw, reason: `"${location}" isn't a recognized Location value — check the Location enum` },
    }
  }

  return {
    row: {
      submittedAt: toIsoTimestamp(raw['timestamp']),
      reportDate: toIsoDate(raw['reportForDate']),
      userEmail: optionalText(raw['userEmail']),
      userName: optionalText(raw['formData.userName']),
      location,
      itemName: raw['item.name'].trim(),
      wasteAmount: parseNumber(raw['item.wasteAmount']),
      is86ed: parseBoolean(raw['item.is86ed']),
      timeOut: optionalText(raw['item.timeOut']), // stored as given, not parsed -- see this guide's notes
      notes: optionalText(raw['formData.notes']),
      noFoodWasteToday: parseBoolean(raw['formData.noFoodWasteToday']),
      no86sToday: parseBoolean(raw['formData.no86sToday']),
    },
    error: null,
  }
}