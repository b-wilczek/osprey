export interface OrderDetailCmuRow {
  orderId: string // Postgres bigint -- kept as a string throughout, see this guide's notes
  dateTime: string // ISO 8601, e.g. 2026-01-31T12:56:28 -- converted from the real YYYY/MM/DD - HH:MM:SS export format by toIsoTimestamp() in validation.ts
  type: string | null
  customerName: string | null
  campus: string | null
  venue: string | null // stored exactly as given, not trimmed -- see this guide's notes
  status: string | null
  total: number | null
  location: string // computed from venue, not a source column -- see this guide's notes
}