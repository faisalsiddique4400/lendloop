import { expect, test } from "vitest";
import { filterTools, sortTools } from "./filterTools";

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

test("sorts newest first, by name, or available first without changing the input", () => {
  const names = (sort: Parameters<typeof sortTools>[1]) => sortTools(tools, sort).map((tool) => tool.name);
  expect(names("newest")).toEqual(["Cordless drill", "Hedge trimmer", "Drill bits"]);
  expect(names("name")).toEqual(["Cordless drill", "Drill bits", "Hedge trimmer"]);
  expect(names("available")).toEqual(["Cordless drill", "Hedge trimmer", "Drill bits"]);
  expect(sortTools([tools[1], tools[0]], "available").map((tool) => tool.name)).toEqual(["Cordless drill", "Hedge trimmer"]);
  expect(tools[0].name).toBe("Cordless drill");
});
