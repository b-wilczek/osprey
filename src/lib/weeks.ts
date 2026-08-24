/**
 * lib/weeks.ts
 *
 * Business-week utilities: Monday–Sunday weeks, using ISO-8601 week/year
 * numbering (week 1 = the week containing the year's first Thursday —
 * this is why week 1 of 2026 is 2025-12-29–2026-01-04).
 *
 * Dates are handled as UTC-anchored calendar dates ('YYYY-MM-DD'), never as
 * local wall-clock Date objects. This matters because the app server
 * (Vercel) may run in a different timezone than the business, and a
 * Postgres `date` column has no timezone at all — it's just a calendar
 * date. Doing week math in local time risks off-by-one-day bugs right
 * around midnight. Every function below either takes/returns a plain
 * 'YYYY-MM-DD' string or constructs Dates via Date.UTC — never
 * `new Date()` or local getters — so results don't depend on where the
 * code happens to run.
 *
 * Verified against known ISO week-date edge cases: 2025-12-29 → week 1 of
 * 2026 (matches the given example), 2026-12-31 / 2027-01-01 → both fall in
 * week 53 of 2026 (2026 is a 53-ISO-week year since Jan 1 lands on a
 * Thursday), 2027-01-04 → week 1 of 2027.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type WeekInfo = {
  /** Monday of the week, as 'YYYY-MM-DD'. */
  start: string;
  /** Sunday of the week, as 'YYYY-MM-DD'. */
  end: string;
  /** ISO week number — 1 through 52 or 53. */
  weekNumber: number;
  /**
   * ISO week-year. NOT always the same as the calendar year of `start` —
   * e.g. start='2025-12-29' has weekYear 2026, since that week belongs to
   * 2026 under ISO rules even though it starts in December.
   */
  weekYear: number;
  /** Human label, e.g. "Week 34 · Aug 17–23, 2026". */
  label: string;
};

// ---------------------------------------------------------------------
// internal helpers
// ---------------------------------------------------------------------

function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Monday=0 ... Sunday=6 (JS's native getUTCDay() is Sunday=0 ... Saturday=6). */
function mondayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

function normalize(date: Date | string): Date {
  return typeof date === 'string' ? parseISODate(date) : parseISODate(toISODate(date));
}

// ---------------------------------------------------------------------
// core week math
// ---------------------------------------------------------------------

/** Monday of the week containing `date`, as 'YYYY-MM-DD'. */
export function getWeekStart(date: Date | string): string {
  const d = normalize(date);
  return toISODate(addDays(d, -mondayIndex(d)));
}

/** Sunday of the week containing `date`, as 'YYYY-MM-DD'. */
export function getWeekEnd(date: Date | string): string {
  return toISODate(addDays(parseISODate(getWeekStart(date)), 6));
}

/** ISO week number (1–52 or 1–53) for the week containing `date`. */
export function getWeekNumber(date: Date | string): number {
  const d = normalize(date);
  // The Thursday of a week determines both its ISO week number and week-year.
  const thursday = addDays(d, 3 - mondayIndex(d));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.floor((thursday.getTime() - yearStart.getTime()) / (7 * DAY_MS)) + 1;
}

/** ISO week-year for the week containing `date` (see WeekInfo.weekYear doc). */
export function getWeekYear(date: Date | string): number {
  const d = normalize(date);
  const thursday = addDays(d, 3 - mondayIndex(d));
  return thursday.getUTCFullYear();
}

/** Full bundle for the week containing `date` — what a page typically wants. */
export function getWeekInfo(date: Date | string): WeekInfo {
  const start = getWeekStart(date);
  const end = getWeekEnd(date);
  const weekNumber = getWeekNumber(date);
  const weekYear = getWeekYear(date);
  return { start, end, weekNumber, weekYear, label: formatWeekLabel(start, end, weekNumber, weekYear) };
}

function formatWeekLabel(start: string, end: string, weekNumber: number, weekYear: number): string {
  const fmt = (iso: string) =>
    parseISODate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `Week ${weekNumber} · ${fmt(start)}–${fmt(end)}, ${weekYear}`;
}

/**
 * Monday (as 'YYYY-MM-DD') of the week `delta` weeks before/after the week
 * containing `date`. Feed a week's own `start` and delta = ±1 for the
 * prev/next arrows.
 */
export function shiftWeek(date: Date | string, delta: number): string {
  return toISODate(addDays(parseISODate(getWeekStart(date)), delta * 7));
}

/** True if `a` and `b` fall in the same Monday–Sunday week. */
export function isSameWeek(a: Date | string, b: Date | string): boolean {
  return getWeekStart(a) === getWeekStart(b);
}

/**
 * Every week (as WeekInfo) from the week containing `from` through the week
 * containing `to`, inclusive — e.g. to populate a week-picker dropdown.
 * Order follows from -> to (reversed automatically if `to` is earlier).
 */
export function getWeeksInRange(from: Date | string, to: Date | string): WeekInfo[] {
  const fromStart = parseISODate(getWeekStart(from));
  const toStart = parseISODate(getWeekStart(to));
  const forward = fromStart.getTime() <= toStart.getTime();
  const [lo, hi] = forward ? [fromStart, toStart] : [toStart, fromStart];

  const weeks: WeekInfo[] = [];
  for (let cursor = lo; cursor.getTime() <= hi.getTime(); cursor = addDays(cursor, 7)) {
    weeks.push(getWeekInfo(toISODate(cursor)));
  }
  return forward ? weeks : weeks.reverse();
}

// ---------------------------------------------------------------------
// URL / "today" helpers
// ---------------------------------------------------------------------

/**
 * Today's date as 'YYYY-MM-DD' in `timeZone` (defaults to the business
 * timezone). Use this instead of `new Date()` for "current week" so a
 * server running in UTC (typical on Vercel) doesn't disagree with the
 * business about what day — or week — it currently is.
 */
export function todayISODate(timeZone: string = 'America/New_York'): string {
  // en-CA locale formats as YYYY-MM-DD.
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

/**
 * Parse a `?week=YYYY-MM-DD` search param into a valid week-start date
 * string. Falls back to the current week if the param is missing, not a
 * real calendar date, or otherwise malformed. A valid but non-Monday date
 * is normalized to that week's Monday rather than rejected.
 */
export function parseWeekParam(
  param: string | string[] | undefined,
  timeZone: string = 'America/New_York',
): string {
  const value = Array.isArray(param) ? param[0] : param;
  if (value && ISO_DATE_RE.test(value) && !Number.isNaN(parseISODate(value).getTime())) {
    return getWeekStart(value);
  }
  return getWeekStart(todayISODate(timeZone));
}