import type { RowError } from '../shared/types'
import type { TransactionDetailRow } from './types'

// Exported so actions.ts can pass it to the shared checkRequiredHeaders()
// up-front check — see the CSV Import Framework guide.
export const REQUIRED_HEADERS = ['Date', 'Time', 'Item', 'Transaction ID', 'Net Sales', 'Location'] as const

function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const n = Number(value.trim().replace(/[$,]/g, ''))
  return Number.isNaN(n) ? null : n
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
): { row: TransactionDetailRow; error: null } | { row: null; error: RowError } {
  const missing = REQUIRED_HEADERS.filter((h) => !raw[h]?.trim())
  if (missing.length > 0) {
    return {
      row: null,
      error: { rowNumber, raw, reason: `Missing required field(s): ${missing.join(', ')}` },
    }
  }

  const location = raw['Location'].trim()
  if (!validLocations.has(location.toLowerCase())) {
    return {
      row: null,
      error: { rowNumber, raw, reason: `"${location}" isn't a recognized Location value — check the Location enum` },
    }
  }

  const netSales = parseNumber(raw['Net Sales'])
  if (netSales === null) {
    return { row: null, error: { rowNumber, raw, reason: `Invalid Net Sales: "${raw['Net Sales']}"` } }
  }

  return {
    row: {
      date: raw['Date'].trim(), // adjust here if your export isn't YYYY-MM-DD
      time: raw['Time'].trim(), // adjust here if your export isn't HH:MM or HH:MM:SS
      timeZone: optionalText(raw['Time Zone']),
      category: optionalText(raw['Category']),
      item: raw['Item'].trim(),
      qty: parseNumber(raw['Qty']),
      pricePointName: optionalText(raw['Price Point Name']),
      sku: optionalText(raw['SKU']),
      modifiersApplied: optionalText(raw['Modifiers Applied']),
      grossSales: parseNumber(raw['Gross Sales']),
      discounts: parseNumber(raw['Discounts']),
      netSales,
      tax: parseNumber(raw['Tax']),
      transactionId: raw['Transaction ID'].trim(),
      paymentId: optionalText(raw['Payment ID']),
      deviceName: optionalText(raw['Device Name']),
      notes: optionalText(raw['Notes']),
      details: optionalText(raw['Details']),
      eventType: optionalText(raw['Event Type']),
      location,
      diningOption: optionalText(raw['Dining Option']),
      customerId: optionalText(raw['Customer ID']),
      customerName: optionalText(raw['Customer Name']),
      customerReferenceId: optionalText(raw['Customer Reference ID']),
      unit: optionalText(raw['Unit']),
      count: parseNumber(raw['Count']),
      gtin: optionalText(raw['GTIN']),
      itemizationType: optionalText(raw['Itemization Type']),
      fulfillmentNote: optionalText(raw['Fulfillment Note']),
      channel: optionalText(raw['Channel']),
      token: optionalText(raw['Token']),
      cardBrand: optionalText(raw['Card Brand']),
      panSuffix: optionalText(raw['PAN Suffix']),
    },
    error: null,
  }
}