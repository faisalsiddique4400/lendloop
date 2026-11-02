"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RequestDialog } from "@/components/RequestDialog";
import { ToolRow, type ListedTool } from "@/components/ToolRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { api } from "@/convex/_generated/api";
import { CATEGORIES } from "@/convex/lib/validators";
import { filterTools } from "@/lib/filterTools";

export default function ToolsPage() {
  const tools = useQuery(api.tools.list);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
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

  const shown = tools ? filterTools(tools, { category, query, onlyFree }) : [];
  const neighbors = new Set(tools?.map((tool) => tool.ownerName)).size;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tools</h1>
          <p className="muted">{tools ? `${tools.length} tools from ${neighbors} neighbors` : "Loading tools"}</p>
        </div>
        <Link href="/listings" className="btn">
          List a tool
        </Link>
      </div>

      <div className="toolbar">
        <div className="search">
          <label htmlFor="q" className="sr">
            Search tools
          </label>
          <input id="q" ref={search} type="search" placeholder="Search tools" value={query} onChange={(e) => setQuery(e.target.value)} />
          <kbd className="kbd" aria-hidden="true">
            /
          </kbd>
        </div>
        <label className="switch">
          <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} /> Available now
        </label>
      </div>

      <div className="chips" role="group" aria-label="Filter by category">
        {["All", ...CATEGORIES].map((name) => (
          <button key={name} type="button" className={name === category ? "chip on" : "chip"} aria-pressed={name === category} onClick={() => setCategory(name)}>
            {name}
          </button>
        ))}
      </div>

      {tools === undefined ? (
        <ListSkeleton />
      ) : shown.length ? (
        <div className="list stagger">
          {shown.map((tool) => (
            <ToolRow key={tool._id} tool={tool} onRequest={() => setAsking(tool)} />
          ))}
        </div>
      ) : (
        <EmptyState title={query.trim() ? `Nothing matches "${query.trim()}"` : "No tools here yet"}>
          <span className="muted">Got one in the shed? List it and your neighbors can borrow it.</span>
        </EmptyState>
      )}

      {asking && <RequestDialog tool={asking} onClose={() => setAsking(null)} />}
    </>
  );
}
