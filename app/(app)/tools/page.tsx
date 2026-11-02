"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RequestDialog } from "@/components/RequestDialog";
import { ToolRow, type ListedTool } from "@/components/ToolRow";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { ListHeader } from "@/components/ui/ListHeader";
import { SearchBox } from "@/components/ui/SearchBox";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { api } from "@/convex/_generated/api";
import { plural } from "@/convex/lib/dates";
import { CATEGORIES } from "@/convex/lib/validators";
import { filterTools, sortTools, type ToolSort } from "@/lib/filterTools";

export default function ToolsPage() {
  const tools = useQuery(api.tools.list);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const [sort, setSort] = useState<ToolSort>("newest");
  const [asking, setAsking] = useState<ListedTool | null>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea, select");
      if (event.key !== "/" || typing) return;
      event.preventDefault();
      search.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shown = tools ? sortTools(filterTools(tools, { category, query, onlyFree }), sort) : [];
  const neighbors = new Set(tools?.filter((tool) => !tool.mine).map((tool) => tool.ownerName)).size;
  const clear = () => {
    setCategory("All");
    setQuery("");
    setOnlyFree(false);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tools</h1>
          <p className="muted">
            {tools ? `${plural(tools.length, "tool")}${neighbors ? ` from ${plural(neighbors, "neighbor")}` : ""}` : "Loading tools"}
          </p>
        </div>
        <Link href="/listings" className="btn">
          List a tool
        </Link>
      </div>

      <div className="toolbar">
        <SearchBox id="q" label="Search tools" value={query} onChange={setQuery} inputRef={search} shortcut="/" />
        <label className="switch">
          <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} /> Available now
        </label>
        <label className="sr" htmlFor="sort">
          Sort tools
        </label>
        <select id="sort" className="select" value={sort} onChange={(e) => setSort(e.target.value as ToolSort)}>
          <option value="newest">Newest</option>
          <option value="name">Name A to Z</option>
          <option value="available">Available first</option>
        </select>
      </div>

      <FilterChips
        label="Filter by category"
        options={["All", ...CATEGORIES].map((name) => ({ id: name, label: name }))}
        value={category}
        onChange={setCategory}
      />

      {tools === undefined ? (
        <ListSkeleton />
      ) : shown.length ? (
        <div className="list stagger">
          <ListHeader columns={["Tool", "Owner", "Status", ""]} />
          {shown.map((tool) => (
            <ToolRow key={tool._id} tool={tool} onRequest={() => setAsking(tool)} />
          ))}
        </div>
      ) : tools.length ? (
        <EmptyState title={query.trim() ? `Nothing matches "${query.trim()}"` : "Nothing matches these filters"}>
          <Button size="sm" onClick={clear}>
            Clear filters
          </Button>
        </EmptyState>
      ) : (
        <EmptyState title="No tools here yet">
          <span className="muted">Got one in the shed? List it and your neighbors can borrow it.</span>
        </EmptyState>
      )}

      {asking && <RequestDialog tool={asking} onClose={() => setAsking(null)} />}
    </>
  );
}
