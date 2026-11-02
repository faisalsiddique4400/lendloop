import { expect, test } from "vitest";
import { countGroups, filterLoans } from "./filterLoans";

const today = "2026-11-02";
const loans = [
  { toolName: "Cordless drill", ownerName: "Ali", borrowerName: "Sara", status: "pending" as const, startDate: "2026-11-05", endDate: "2026-11-08" },
  { toolName: "Hedge trimmer", ownerName: "Kenji", borrowerName: "Ali", status: "approved" as const, startDate: "2026-10-30", endDate: "2026-11-04" },
  { toolName: "Pipe wrench", ownerName: "Ali", borrowerName: "Kenji", status: "approved" as const, startDate: "2026-10-20", endDate: "2026-10-28" },
  { toolName: "Stand mixer", ownerName: "Priya", borrowerName: "Ali", status: "declined" as const, startDate: "2026-11-03", endDate: "2026-11-03" },
  { toolName: "Tent", ownerName: "Luis", borrowerName: "Ali", status: "returned" as const, startDate: "2026-10-01", endDate: "2026-10-03" },
];
const tools = (group: Parameters<typeof filterLoans>[1]["group"], query = "") =>
  filterLoans(loans, { group, query }, today).map((loan) => loan.toolName);

test("groups loans by what they need: waiting, out now, overdue, closed", () => {
  expect(tools("all")).toHaveLength(5);
  expect(tools("waiting")).toEqual(["Cordless drill"]);
  expect(tools("out")).toEqual(["Hedge trimmer"]);
  expect(tools("overdue")).toEqual(["Pipe wrench"]);
  expect(tools("closed")).toEqual(["Stand mixer", "Tent"]);
  expect(countGroups(loans, today)).toEqual({ all: 5, waiting: 1, out: 1, overdue: 1, closed: 2 });
});

test("search matches the tool or either neighbor, ignoring case", () => {
  expect(tools("all", " kenji ")).toEqual(["Hedge trimmer", "Pipe wrench"]);
  expect(tools("closed", "TENT")).toEqual(["Tent"]);
  expect(tools("waiting", "tent")).toEqual([]);
});
