import { effectiveStatus, type DisplayStatus } from "../convex/lib/dates";
import type { LoanStatus } from "../convex/lib/validators";

export const LOAN_GROUPS = [
  ["all", "All"],
  ["waiting", "Waiting"],
  ["out", "Out now"],
  ["overdue", "Overdue"],
  ["closed", "Closed"],
] as const;

export type LoanGroup = (typeof LOAN_GROUPS)[number][0];

type FilterableLoan = { toolName: string; ownerName: string; borrowerName: string; status: LoanStatus; startDate: string; endDate: string };

const GROUP_OF: Record<DisplayStatus, Exclude<LoanGroup, "all">> = {
  pending: "waiting",
  approved: "out",
  overdue: "overdue",
  declined: "closed",
  returned: "closed",
};

export const groupOf = (loan: FilterableLoan, today: string) => GROUP_OF[effectiveStatus(loan, today)];

export function filterLoans<T extends FilterableLoan>(loans: T[], filter: { group: LoanGroup; query: string }, today: string) {
  const query = filter.query.trim().toLowerCase();
  return loans.filter(
    (loan) =>
      (filter.group === "all" || groupOf(loan, today) === filter.group) &&
      (!query || [loan.toolName, loan.ownerName, loan.borrowerName].some((text) => text.toLowerCase().includes(query))),
  );
}

export function countGroups(loans: FilterableLoan[], today: string) {
  const counts: Record<LoanGroup, number> = { all: loans.length, waiting: 0, out: 0, overdue: 0, closed: 0 };
  for (const loan of loans) counts[groupOf(loan, today)] += 1;
  return counts;
}
