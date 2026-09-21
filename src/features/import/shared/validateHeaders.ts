// Runs once, before any row-by-row validation. Catches "wrong dropdown
// option selected" as ONE clear error instead of letting it surface as
// hundreds/thousands of individual "missing required field" row errors —
// which is technically correct but a bad way to find out you picked the
// wrong import type.
export function checkRequiredHeaders(
  headers: string[],
  requiredHeaders: readonly string[],
  importLabel: string
): string | null {
  const missing = requiredHeaders.filter((h) => !headers.includes(h))
  if (missing.length === 0) return null

  return (
    `This file doesn't look like ${importLabel} — missing expected column(s): ` +
    `${missing.join(', ')}. Check that you selected the right import type above, ` +
    `and that the file's header row is intact.`
  )
}