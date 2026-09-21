'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import type { ImportResult, RowError } from '../shared/types'
import { parseCsvText } from '../shared/parseCsv'
import { ImportResults } from './ImportResults'
import { importTimesheetCsv } from '../timesheet/actions'
import { importTransactionDetailsCsv } from '../transactionDetails/actions'
import { importTransactionDetailsCmuCsv } from '../transactionDetailsCmu/actions'
import { importEodWasteCsv } from '../eodWaste/actions'
import { importOrderDetailsCmuCsv } from '../orderDetailsCmu/actions'


interface ImportType {
  value: string
  label: string
  action: (formData: FormData) => Promise<ImportResult>
  groupByColumn?: string
}

// Adding a new import type is: one module under features/import/<name>/
// (types.ts, validation.ts, actions.ts, built the same way timesheet's
// is), plus one entry in this array. Nothing else in this file changes.
const IMPORT_TYPES: ImportType[] = [
  { value: 'timesheet', label: 'Timesheet Data (Deputy)', action: importTimesheetCsv },
  { value: 'transactionDetails', label: 'Transaction Details (Square)', action: importTransactionDetailsCsv, groupByColumn: 'Transaction ID' },
  { value: 'transactionDetailsCmu', label: 'Transaction Details (CMU)', action: importTransactionDetailsCmuCsv },
  { value: 'eodWaste', label: 'End of Day 86+Waste', action: importEodWasteCsv },
  { value: 'orderDetailsCmu', label: 'Order Details (CMU)', action: importOrderDetailsCmuCsv },
]

interface FileResult {
  fileName: string
  result: ImportResult
}

// Comfortably under the 10MB next.config.js Server Action limit set up
// below — big enough that a typical export never touches this, small
// enough that even an unusually busy week's file has real headroom before
// it needs splitting at all.
const CHUNK_THRESHOLD_BYTES = 2_000_000 // ~2MB
const TARGET_CHUNK_BYTES = 1_500_000 // ~1.5MB per request once chunking kicks in

interface UploadItem {
  file: File
  displayName: string
  rowOffset: number // 0 for a whole file; how many data rows come before this piece, for a chunk of a larger file
}

// A file over the threshold is split into several smaller CSVs client-side
// (same header repeated on each) rather than solved by raising a body-size
// number forever as exports grow. Every resulting piece still goes through
// the exact same server-side pipeline as a normal file — chunking only
// changes what gets sent over the wire, never how a row is validated or
// written.
async function planUploads(file: File, groupByColumn?: string): Promise<UploadItem[]> {
  if (file.size <= CHUNK_THRESHOLD_BYTES) {
    return [{ file, displayName: file.name, rowOffset: 0 }]
  }

  const text = await file.text()
  const { rows, headers } = parseCsvText(text) // same parser the server uses — chunk boundaries land on real rows, never mid-row
  if (rows.length === 0) return [{ file, displayName: file.name, rowOffset: 0 }]

  const bytesPerRow = file.size / rows.length
  const rowsPerChunk = Math.max(1, Math.floor(TARGET_CHUNK_BYTES / bytesPerRow))

  const items: UploadItem[] = []
  let start = 0
  while (start < rows.length) {
    let end = Math.min(start + rowsPerChunk, rows.length)

    // Extend this chunk forward past the target boundary until
    // groupByColumn's value actually changes, so every row of a group
    // (a Transaction ID's line items) lands in the same chunk.
    if (groupByColumn && end < rows.length) {
      const boundaryValue = rows[end - 1][groupByColumn]
      while (end < rows.length && rows[end][groupByColumn] === boundaryValue) {
        end++
      }
    }

    const chunkRows = rows.slice(start, end)
    const csvText = Papa.unparse({ fields: headers, data: chunkRows })
    const displayName = `${file.name} (rows ${start + 1}–${end})`
    items.push({ file: new File([csvText], displayName, { type: 'text/csv' }), displayName, rowOffset: start })
    start = end
  }
  return items
}

// rowNumber 0 means "the whole file/chunk," not one row — leave those
// alone. Every real row number gets shifted back to what it actually is
// in the ORIGINAL file, so a chunked upload's error table is exactly as
// usable as an unchunked one — no mental math to find the real row.
function offsetErrors(errors: RowError[], rowOffset: number): RowError[] {
  if (rowOffset === 0) return errors
  return errors.map((e) => (e.rowNumber === 0 ? e : { ...e, rowNumber: e.rowNumber + rowOffset }))
}

export function ImportForm() {
  const [selected, setSelected] = useState(IMPORT_TYPES[0].value)
  const [results, setResults] = useState<FileResult[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const importType = IMPORT_TYPES.find((t) => t.value === selected) ?? IMPORT_TYPES[0]

  async function handleSubmit(formData: FormData) {
    // getAll, not get — the file input allows selecting several files under
    // the same "file" field name.
    const files = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0)
    if (files.length === 0) return

    setIsSubmitting(true)
    setResults([])

    // Expand any oversized file into several smaller uploads up front, so
    // the loop below doesn't need to know or care which items are whole
    // files and which are pieces of one.
    const uploads = (await Promise.all(files.map((file) => planUploads(file, importType.groupByColumn)))).flat()

    const collected: FileResult[] = []

    // Sequential, not Promise.all. Each call's natural-key lookup reads
    // whatever is in the database AT THAT MOMENT — that's what makes two
    // overlapping pieces (two real files that overlap a date, or two
    // chunks of the same big file) resolve correctly as an
    // insert-then-update instead of two competing inserts. Running them in
    // parallel would let two calls both see a row as "new" before either
    // insert has committed, and race to create it twice — the exact class
    // of bug the shared batch-write/dedup layer exists to explain clearly
    // within a single upload, just reintroduced across uploads instead.
    for (let i = 0; i < uploads.length; i++) {
      setProgress({ done: i, total: uploads.length })
      const { file, displayName, rowOffset } = uploads[i]
      const singleFileData = new FormData()
      singleFileData.set('file', file)
      const result = await importType.action(singleFileData)
      collected.push({
        fileName: displayName,
        result: { ...result, errors: offsetErrors(result.errors, rowOffset) },
      })
      setResults([...collected]) // show each piece's result as it finishes, not all at once at the end
    }

    setProgress(null)
    setIsSubmitting(false)
  }

  return (
    <div>
      <form action={handleSubmit} className="flex items-center gap-3">
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value)
            setResults([])
          }}
          className="rounded border border-gray-300 px-2 py-2 text-sm"
        >
          {IMPORT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input type="file" name="file" accept=".csv" required multiple className="text-sm" />
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isSubmitting && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
          aria-hidden="true"
      />
         )}
        {isSubmitting
          ? progress
          ? `Importing ${progress.done + 1} of ${progress.total}...`
          : 'Importing...'
          : `Import ${importType.label}`}
        </button>
      </form>

      {results.map(({ fileName, result }, i) => (
        <div key={`${fileName}-${i}`} className="mt-4">
          <p className="text-sm font-semibold">{fileName}</p>
          <ImportResults result={result} />
        </div>
      ))}
    </div>
  )
}