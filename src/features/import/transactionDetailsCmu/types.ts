export interface TransactionDetailCmuRow {
  orderDate: string // YYYY-MM-DD -- converted from Grubhub's real MM-DD-YY by toIsoDate() in validation.ts, not passed through as-is
  timeInterval: string | null
  campus: string | null
  venue: string
  category: string | null
  item: string
  modifierGroup: string | null
  modifier: string | null
  quantity: number | null
  percentQuantity: number | null
  salePrice: number | null
  subtotalSalePrice: number | null
  merchantDiscount: number | null
  totalMerchantSale: number | null
  location: string // computed from venue, not a source column
  // No rowDataType field here -- row_data_type is a database-generated
  // column (GENERATED ALWAYS AS (...) STORED from % Quantity), computed
  // by Postgres itself. The app never sets it; see Step 7.
}