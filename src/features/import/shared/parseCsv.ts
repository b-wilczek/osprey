import Papa from 'papaparse'

export interface ParsedCsv {
  rows: Record<string, string>[]
  headers: string[]
}

export function parseCsvText(text: string): ParsedCsv {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
  return {
    rows: parsed.data,
    headers: parsed.meta.fields ?? [],
  }
}