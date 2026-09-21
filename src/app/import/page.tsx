import { Suspense } from 'react'
import { ImportForm } from '@/features/import/components/ImportForm'
import { DatasetFreshnessTable } from '@/features/import/components/DatasetFreshnessTable'

export default function ImportPage() {
  return (
    <main className="p-10">
      <h1 className="mb-6 text-2xl font-bold">Database Import</h1>
      <ImportForm />
      <Suspense fallback={<p className="mt-10 text-sm text-gray-500">Loading dataset freshness...</p>}>
      <DatasetFreshnessTable />
      </Suspense>
    </main>
  )
}



