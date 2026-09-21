import type { SupabaseClient } from '@supabase/supabase-js'

const IN_BATCH_SIZE = 200
const PAGE_SIZE = 1000

// Like fetchExistingKeys(), but for an import whose existing-row check
// needs a composite multi-column key, not just "does this ID already
// exist." The caller needs full matching rows back (every column the
// composite key touches) to build its own key map locally.
//
// Needed whenever the LEADING column of that composite key is itself
// high-cardinality and roughly one-per-group-of-rows (a form submission
// timestamp, say) rather than naturally bounded like a calendar date.
// That shape needs both defenses this framework has hit separately:
// fetchExistingKeys()'s batched `.in()` (so the request URL doesn't grow
// unbounded with distinct values), AND CMU's `.range()` paging (so a
// single batch's response doesn't silently truncate at Supabase's
// default 1,000-row cap) — a batch of 200 high-cardinality values can
// still legitimately match well over 1,000 real rows if each value
// covers several (e.g. 200 submission timestamps at ~10 items each is
// already 2,000 rows).
export async function fetchExistingRows<T>(
  supabase: SupabaseClient,
  table: string,
  column: string,
  values: string[],
  select: string,
  orderColumn: string
): Promise<T[]> {
  const unique = [...new Set(values)]
  if (unique.length === 0) return []

  const results: T[] = []

  for (let i = 0; i < unique.length; i += IN_BATCH_SIZE) {
    const batch = unique.slice(i, i + IN_BATCH_SIZE)

    // .order() is required, not cosmetic — .range() pages are only
    // guaranteed non-overlapping and gap-free against a stable sort.
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .in(column, batch)
        .order(orderColumn, { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) throw error

      results.push(...((data ?? []) as T[]))
      if (!data || data.length < PAGE_SIZE) break
    }
  }

  return results
}