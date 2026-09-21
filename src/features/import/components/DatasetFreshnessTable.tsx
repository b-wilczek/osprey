import { formatSlashDate } from '@/lib/format'
import { getDatasetDateRanges } from '../shared/dateRanges'

export async function DatasetFreshnessTable() {
  const ranges = await getDatasetDateRanges()

  return (
    <div className="mt-10">
      <h2 className="mb-2 text-sm font-semibold text-gray-700">Dataset Freshness</h2>
      <table className="w-full max-w-xl border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b px-2 py-1 text-left">Dataset</th>
            <th className="border-b px-2 py-1 text-left">Oldest</th>
            <th className="border-b px-2 py-1 text-left">Newest</th>
          </tr>
        </thead>
        <tbody>
          {ranges.map((r) => (
            <tr key={r.label}>
              <td className="border-b px-2 py-1">{r.label}</td>
              <td className="border-b px-2 py-1">{r.oldest ? formatSlashDate(r.oldest) : '—'}</td>
              <td className="border-b px-2 py-1">{r.newest ? formatSlashDate(r.newest) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}