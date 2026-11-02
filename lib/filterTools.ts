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
