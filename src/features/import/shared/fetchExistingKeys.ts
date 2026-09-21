import type { SupabaseClient } from '@supabase/supabase-js'

const BATCH_SIZE = 200

export async function fetchExistingKeys(
  supabase: SupabaseClient,
  table: string,
  column: string,
  values: string[]
): Promise<Set<string>> {
  const unique = [...new Set(values)]
  if (unique.length === 0) return new Set()

  const batches: string[][] = []
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    batches.push(unique.slice(i, i + BATCH_SIZE))
  }

  const results = await Promise.all(
    batches.map((batch) => supabase.from(table).select(column).in(column, batch))
  )

  const firstError = results.find((r) => r.error)?.error
  if (firstError) throw firstError

  const found = new Set<string>()
  for (const { data } of results) {
    for (const row of data ?? []) {
      found.add((row as unknown as Record<string, string>)[column])
    }
  }
  return found
}