import type { RowError, TimesheetRow } from './types'

export const REQUIRED_HEADERS = [
  'Display Name',
  'Timesheet Date',
  'Timesheet Start Time',
  'Timesheet End Time',
  'Timesheet Total Time',
] as const

// The one mapped location value that's expected NOT to be a real Location
// enum member — see the guide's notes on why this becomes location = null
// instead of a validation error.
const ON_LEAVE_MARKER = 'On Leave'

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false
  const v = value.trim().toLowerCase()
  return v === 'true' || v === 'yes' || v === 'y' || v === '1'
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const n = Number(value.trim().replace(/[$,]/g, ''))
  return Number.isNaN(n) ? null : n
}

function toIso24HourTime(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (!match) return trimmed // already 24-hour, or unrecognized -- let downstream validation/the database catch it
  const [, hStr, m, sStr, period] = match
  let h = Number(hStr) % 12
  if (period.toUpperCase() === 'PM') h += 12
  const s = sStr ?? '00'
  return `${String(h).padStart(2, '0')}:${m}:${s}`
}

export interface LocationLookup {
  // Deputy location string (trimmed, lowercased) -> your CommonLocationName
  byDeputyName: Map<string, string>
  // What a blank/missing raw location resolves to (from the mapping
  // table's NULL-DeputyName row) — typically "On Leave", or null if that
  // row doesn't exist for some reason.
  forBlank: string | null
}

function resolveLocation(
  rawLocation: string,
  lookup: LocationLookup,
  validLocations: Set<string>
): { location: string | null; error: string | null } {
  const trimmed = rawLocation.trim()

  const mapped = trimmed === '' ? lookup.forBlank : lookup.byDeputyName.get(trimmed.toLowerCase())

  if (mapped === null || mapped === undefined) {
    return {
      location: null,
      error: `No mapping found for location "${trimmed || '(blank)'}" — check "Timesheet Location to Common Name Key"`,
    }
  }

  if (mapped.toLowerCase() === ON_LEAVE_MARKER.toLowerCase()) {
    return { location: null, error: null } // intentional — see guide notes
  }

  if (!validLocations.has(mapped.toLowerCase())) {
    return {
      location: null,
      error: `Mapped location "${mapped}" (from "${trimmed}") isn't a recognized Location value — check the mapping table and the enum`,
    }
  }

  return { location: mapped, error: null }
}

export function validateRow(
  raw: Record<string, string>,
  rowNumber: number,
  lookup: LocationLookup,
  validLocations: Set<string>
): { row: TimesheetRow; error: null } | { row: null; error: RowError } {
  const missing = REQUIRED_HEADERS.filter((h) => !raw[h]?.trim())
  if (missing.length > 0) {
    return {
      row: null,
      error: { rowNumber, raw, reason: `Missing required field(s): ${missing.join(', ')}` },
    }
  }

  const { location, error: locationError } = resolveLocation(raw['Location'] ?? '', lookup, validLocations)
  if (locationError) {
    return { row: null, error: { rowNumber, raw, reason: locationError } }
  }

  const totalHours = parseNumber(raw['Timesheet Total Time'])
  if (totalHours === null) {
    return {
      row: null,
      error: {
        rowNumber,
        raw,
        reason: `Invalid Timesheet Total Time: "${raw['Timesheet Total Time']}"`,
      },
    }
  }

  return {
    row: {
      displayName: raw['Display Name'].trim(),
      timesheetDate: raw['Timesheet Date'].trim(), // adjust here if your export isn't YYYY-MM-DD
      startTime: toIso24HourTime(raw['Timesheet Start Time']),
      endTime: toIso24HourTime(raw['Timesheet End Time']),
      totalHours,
      cost: parseNumber(raw['Timesheet Cost']), // null is fine — see guide notes
      location, // already resolved to your CommonLocationName, or null for leave
      isLeave: parseBoolean(raw['Leave?']),
    },
    error: null,
  }
}