import { format } from "date-fns";
import { fr } from "date-fns/locale";

// The team works in Madagascar time. "Today" must not depend on the server's timezone (Vercel runs in UTC),
// otherwise the calendar day is wrong for 3 hours every night.
const BUSINESS_TZ = "Indian/Antananarivo";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/** "YYYY-MM-DD" of `date` as seen in Madagascar. */
export function dateInputValue(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayInputValue(): string {
  return dateInputValue(new Date());
}

/** Adds `days` to a "YYYY-MM-DD" string (pure calendar arithmetic, no timezone involved). */
export function addDays(dayString: string, days: number): string {
  const d = new Date(`${dayString}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Adds `months` to a "YYYY-MM" string. */
export function addMonths(monthString: string, months: number): string {
  const [year, month] = monthString.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function yesterdayInputValue(): string {
  return addDays(todayInputValue(), -1);
}

export function currentMonthInputValue(): string {
  return todayInputValue().slice(0, 7);
}

export function lastMonthInputValue(): string {
  return addMonths(currentMonthInputValue(), -1);
}

/** Returns `value` if it is a real "YYYY-MM-DD" date, otherwise `fallback`. */
export function validDayOr(value: string | undefined, fallback: string): string {
  return value && DAY_RE.test(value) && !Number.isNaN(new Date(value).getTime()) ? value : fallback;
}

/** Returns `value` if it is a real "YYYY-MM" month, otherwise `fallback`. */
export function validMonthOr(value: string | undefined, fallback: string): string {
  return value && MONTH_RE.test(value) && !Number.isNaN(new Date(`${value}-01`).getTime()) ? value : fallback;
}

/** [gte, lt) range matching how gain/expense `date` fields are stored (new Date("YYYY-MM-DD"), i.e. UTC midnight of that date). */
export function getDayRange(dateString: string): { gte: Date; lt: Date } {
  const start = new Date(dateString);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

/** [gte, lt) range covering a whole "YYYY-MM" month, same UTC-midnight convention as getDayRange. */
export function getMonthRange(monthString: string): { gte: Date; lt: Date } {
  const start = new Date(`${monthString}-01`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { gte: start, lt: end };
}

// Labels are built from noon UTC so the displayed calendar day is right in any timezone.
export function formatDayLabel(dateString: string): string {
  return format(new Date(`${dateString}T12:00:00Z`), "d MMMM yyyy", { locale: fr });
}

export function formatMonthLabel(monthString: string): string {
  return format(new Date(`${monthString}-15T12:00:00Z`), "MMMM yyyy", { locale: fr });
}

// Stored dates are UTC midnight of the chosen day: read them back in UTC so the day never shifts.
export function formatDate(date: Date): string {
  return format(new Date(date.getTime() + 12 * 3600 * 1000), "d MMM yyyy", { locale: fr });
}

/** "14:32" in Madagascar time. */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: BUSINESS_TZ, hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: BUSINESS_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
