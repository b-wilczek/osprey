/**
 * Converts a 24-hour 'HH:MM:SS' time string to a 12-hour display string,
 * e.g. '18:00:00' -> '6:00 PM'. Returns '—' for null/missing/unparseable
 * input rather than throwing.
 */
export function formatTime12h(time: string | null | undefined): string {
  if (!time) return '—'
  const [hStr, mStr] = time.split(':')
  const hours24 = Number(hStr)
  if (Number.isNaN(hours24) || !mStr) return '—'
  const period = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  return `${hours12}:${mStr} ${period}`
}

/**
 * Formats a 'YYYY-MM-DD' date string as e.g. 'Mon, Aug 17'. Parses as UTC
 * to avoid a local-timezone off-by-one, same reasoning as lib/weeks.ts.
 */
export function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

/**
 * Formats a 'YYYY-MM-DD' date string as e.g. 'Aug 17' — same UTC-parsing
 * reasoning as formatShortDate, just without the weekday, for contexts
 * (like chart axis labels) where the extra width doesn't fit.
 */
export function formatMonthDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * Formats a 'YYYY-MM-DD' date string as 'MM/DD/YYYY'. Pure string
 * reordering, no Date object involved — the input is always already
 * zero-padded, so there's no timezone-parsing pitfall to avoid.
 */
export function formatSlashDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${m}/${d}/${y}`
}