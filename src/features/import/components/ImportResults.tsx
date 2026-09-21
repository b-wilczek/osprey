import type { ImportResult, RowError } from '../shared/types'

export function ImportResults({ result }: { result: ImportResult }) {
  return (
    <div className="mt-6 rounded border border-gray-200 p-4">
      <p className="mb-2 text-sm font-medium">
        {result.totalRows} rows processed — {result.inserted} added, {result.updated} updated,
        {result.skipped > 0 && <> {result.skipped} skipped (already imported),</>} {result.failed} failed.
      </p>
      {result.errors.length > 0 && (
        <RowTable rows={result.errors} tone="error" />
      )}
      {result.skippedRows.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-gray-500">Skipped (already imported)</p>
          <RowTable rows={result.skippedRows} tone="neutral" />
        </div>
      )}
    </div>
  )
}

function RowTable({ rows, tone }: { rows: RowError[]; tone: 'error' | 'neutral' }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="border-b px-2 py-1 text-left">Row</th>
          <th className="border-b px-2 py-1 text-left">Reason</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e, i) => (
          <tr key={i}>
            <td className={`border-b px-2 py-1 ${tone === 'error' ? 'text-red-700' : 'text-gray-500'}`}>
              {e.rowNumber || '—'}
            </td>
            <td className={`border-b px-2 py-1 ${tone === 'error' ? 'text-red-700' : 'text-gray-500'}`}>
              {e.reason}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}