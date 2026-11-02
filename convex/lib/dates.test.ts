import { describe, expect, test } from "vitest";
import {
  addDays,
  daysBetween,
  effectiveStatus,
  formatRange,
  isIsoDate,
  overlaps,
  plural,
  presets,
  timingLabel,
} from "./dates";

describe("dates", () => {
  test("addDays and daysBetween cross month ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-11-02", -3)).toBe("2026-10-30");
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
  });

  test("overlaps counts a shared edge day", () => {
    const booked = { startDate: "2026-11-05", endDate: "2026-11-08" };
    expect(overlaps(booked, { startDate: "2026-11-08", endDate: "2026-11-09" })).toBe(true);
    expect(overlaps(booked, { startDate: "2026-11-09", endDate: "2026-11-10" })).toBe(false);
  });

  test("presets on a Monday, a Saturday and a Sunday", () => {
    expect(presets("2026-11-02").map((p) => [p.label, p.startDate, p.endDate])).toEqual([
      ["Tomorrow", "2026-11-03", "2026-11-03"],
      ["This weekend", "2026-11-07", "2026-11-08"],
      ["A week", "2026-11-03", "2026-11-09"],
    ]);
    expect(presets("2026-11-07")[1]).toMatchObject({ startDate: "2026-11-07", endDate: "2026-11-08" });
    expect(presets("2026-11-08")[1]).toMatchObject({ startDate: "2026-11-08", endDate: "2026-11-08" });
  });

  test("an approved loan past its end date is overdue", () => {
    const loan = { status: "approved" as const, startDate: "2026-10-20", endDate: "2026-10-28" };
    expect(effectiveStatus(loan, "2026-11-02")).toBe("overdue");
    expect(timingLabel(loan, "2026-11-02")).toBe("5 days late");
  });

  test("timing labels", () => {
    const today = "2026-11-02";
    expect(timingLabel({ status: "pending", startDate: "2026-11-05", endDate: "2026-11-08" }, today)).toBe("Starts in 3 days");
    expect(timingLabel({ status: "pending", startDate: today, endDate: "2026-11-08" }, today)).toBe("Starts today");
    expect(timingLabel({ status: "approved", startDate: "2026-10-30", endDate: "2026-11-03" }, today)).toBe("Due back in 1 day");
    expect(timingLabel({ status: "approved", startDate: "2026-10-30", endDate: today }, today)).toBe("Due back today");
    expect(timingLabel({ status: "returned", startDate: "2026-10-02", endDate: "2026-10-04" }, today)).toBe("");
  });

  test("formatting and checks", () => {
    expect(formatRange("2026-11-05", "2026-11-08")).toBe("Nov 5 to Nov 8");
    expect(plural(1, "day")).toBe("1 day");
    expect(plural(2, "request")).toBe("2 requests");
    expect(isIsoDate("2026-11-05")).toBe(true);
    expect(isIsoDate("11/05/2026")).toBe(false);
    expect(isIsoDate("2026-02-31")).toBe(false);
    expect(isIsoDate("2026-13-45")).toBe(false);
  });
});
