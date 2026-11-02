import { expect, test } from "vitest";
import { filterTools } from "./filterTools";

const tools = [
  { name: "Cordless drill", category: "Power tools", available: true },
  { name: "Hedge trimmer", category: "Garden", available: false },
  { name: "Drill bits", category: "Hand tools", available: false },
];

test("filters by category, search text and availability together", () => {
  const names = (filter: Parameters<typeof filterTools>[1]) => filterTools(tools, filter).map((tool) => tool.name);
  expect(names({ category: "All", query: "", onlyFree: false })).toHaveLength(3);
  expect(names({ category: "All", query: "  DRILL ", onlyFree: false })).toEqual(["Cordless drill", "Drill bits"]);
  expect(names({ category: "All", query: "drill", onlyFree: true })).toEqual(["Cordless drill"]);
  expect(names({ category: "Garden", query: "", onlyFree: false })).toEqual(["Hedge trimmer"]);
});
