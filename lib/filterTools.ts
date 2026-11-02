export type ToolFilter = { category: string; query: string; onlyFree: boolean };

export function filterTools<T extends { name: string; category: string; available: boolean }>(tools: T[], filter: ToolFilter) {
  const query = filter.query.trim().toLowerCase();
  return tools.filter(
    (tool) =>
      (filter.category === "All" || tool.category === filter.category) &&
      (!filter.onlyFree || tool.available) &&
      (!query || tool.name.toLowerCase().includes(query)),
  );
}

export type ToolSort = "newest" | "name" | "available";

export function sortTools<T extends { name: string; available: boolean }>(tools: T[], sort: ToolSort) {
  if (sort === "name") return tools.toSorted((a, b) => a.name.localeCompare(b.name));
  if (sort === "available") return tools.toSorted((a, b) => Number(b.available) - Number(a.available));
  return tools;
}
