import type { RowError } from './types'

export interface KeyedRow<T> {
  data: T
  rowNumber: number
}

export interface WriteItem {
  record: Record<string, unknown>
  rowNumber: number
}

// Groups this file's OWN rows by natural key before deciding insert vs.
// update, so two rows in the same file sharing a key are caught up front
// (reported by row number) instead of both being classified as "insert"
// and colliding with each other at the database's unique constraint —
// which is what happened on the first real multi-thousand-row timesheet
// file. `existingByKey` maps a natural key to the id of a row already in
// the database, if one exists.
export function splitInsertsAndUpdates<T>(
  rows: KeyedRow<T>[],
  keyOf: (data: T) => string,
  existingByKey: Map<string, number | string>,
  toRecord: (data: T, existingId?: number | string) => Record<string, unknown>,
  duplicateReason: (rowNumbers: number[]) => string,
  options?: {
    onExistingMatch?: 'update' | 'skip'
    skipReason?: (existingId: number | string) => string
  }
): { toInsert: WriteItem[]; toUpdate: WriteItem[]; skipped: RowError[]; errors: RowError[] } {
  const mode = options?.onExistingMatch ?? 'update'
  const rowsByKey = new Map<string, KeyedRow<T>[]>()
  for (const row of rows) {
    const key = keyOf(row.data)
    const group = rowsByKey.get(key) ?? []
    group.push(row)
    rowsByKey.set(key, group)
  }

  const toInsert: WriteItem[] = []
  const toUpdate: WriteItem[] = []
  const skipped: RowError[] = []
  const errors: RowError[] = []

  for (const [key, group] of rowsByKey) {
    if (group.length > 1) {
      const rowNumbers = group.map((r) => r.rowNumber)
      for (const row of group) {
        errors.push({ rowNumber: row.rowNumber, raw: {}, reason: duplicateReason(rowNumbers) })
      }
      continue
    }

    const row = group[0]
    const existingId = existingByKey.get(key)

    if (existingId && mode === 'skip') {
      skipped.push({
        rowNumber: row.rowNumber,
        raw: {},
        reason: options?.skipReason
          ? options.skipReason(existingId)
          : `Already imported (matches existing row ${existingId}) — skipped, not overwritten.`,
      })
      continue
    }

    const record = toRecord(row.data, existingId)
    if (existingId) toUpdate.push({ record, rowNumber: row.rowNumber })
    else toInsert.push({ record, rowNumber: row.rowNumber })
  }

  return { toInsert, toUpdate, skipped, errors }
}