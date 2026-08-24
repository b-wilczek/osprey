interface StatTileProps {
  label: string
  value: string
  footnote?: string
}

export function StatTile({ label, value, footnote }: StatTileProps) {
  return (
    <div>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
      {footnote && <div className="mt-1 text-xs text-gray-400">{footnote}</div>}
    </div>
  )
}