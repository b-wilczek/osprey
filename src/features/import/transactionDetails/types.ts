export interface TransactionDetailRow {
  date: string // YYYY-MM-DD
  time: string // HH:MM:SS
  timeZone: string | null
  category: string | null
  item: string
  qty: number | null
  pricePointName: string | null
  sku: string | null
  modifiersApplied: string | null
  grossSales: number | null
  discounts: number | null
  netSales: number
  tax: number | null
  transactionId: string
  paymentId: string | null
  deviceName: string | null
  notes: string | null
  details: string | null
  eventType: string | null
  location: string
  diningOption: string | null
  customerId: string | null
  customerName: string | null
  customerReferenceId: string | null
  unit: string | null
  count: number | null
  gtin: string | null
  itemizationType: string | null
  fulfillmentNote: string | null
  channel: string | null
  token: string | null
  cardBrand: string | null
  panSuffix: string | null
}