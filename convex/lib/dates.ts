import type { LoanStatus } from "./validators";

const DAY_MS = 86_400_000;

type Span = { startDate: string; endDate: string };
type LoanDates = Span & { status: LoanStatus };
export type DisplayStatus = LoanStatus | "overdue";

export const todayIso = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const localToday = () => new Date().toLocaleDateString("en-CA");
export const addDays = (iso: string, days: number) => todayIso(Date.parse(iso) + days * DAY_MS);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
export const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
export const overlaps = (a: Span, b: Span) => a.startDate <= b.endDate && b.startDate <= a.endDate;
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const formatRange = (start: string, end: string) => `${formatDay(start)} to ${formatDay(end)}`;

export function effectiveStatus(loan: LoanDates, today: string): DisplayStatus {
  return loan.status === "approved" && loan.endDate < today ? "overdue" : loan.status;
}

export function timingLabel(loan: LoanDates, today: string) {
  const status = effectiveStatus(loan, today);
  if (status === "pending") {
    const days = daysBetween(today, loan.startDate);
    return days > 0 ? `Starts in ${plural(days, "day")}` : days === 0 ? "Starts today" : "";
  }
  if (status === "overdue") return `${plural(daysBetween(loan.endDate, today), "day")} late`;
  if (status === "approved") {
    const days = daysBetween(today, loan.endDate);
    return days === 0 ? "Due back today" : `Due back in ${plural(days, "day")}`;
  }
  return "";
}

export function presets(today: string) {
  const weekday = new Date(today).getUTCDay();
  const saturday = addDays(today, (6 - weekday + 7) % 7);
  const tomorrow = addDays(today, 1);
  return [
    { label: "Tomorrow", startDate: tomorrow, endDate: tomorrow },
    weekday === 0
      ? { label: "This weekend", startDate: today, endDate: today }
      : { label: "This weekend", startDate: saturday, endDate: addDays(saturday, 1) },
    { label: "A week", startDate: tomorrow, endDate: addDays(today, 7) },
  ];
}
