"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { LoanRow } from "@/components/LoanRow";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { ListHeader } from "@/components/ui/ListHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { api } from "@/convex/_generated/api";
import { todayIso } from "@/convex/lib/dates";
import { countGroups, filterLoans, LOAN_GROUPS, type LoanGroup } from "@/lib/filterLoans";

export default function RequestsPage() {
  const incoming = useQuery(api.loans.incoming);
  const mine = useQuery(api.loans.mine);
  const [tab, setTab] = useState<"in" | "mine">("in");
  const [group, setGroup] = useState<LoanGroup>("all");
  const [openedAt] = useState(() => Date.now());
  const [today] = useState(todayIso);

  const rows = tab === "in" ? incoming : mine;
  const counts = incoming ? countGroups(incoming, today) : null;
  const summary = counts && ([counts.waiting && `${counts.waiting} waiting on you`, counts.overdue && `${counts.overdue} overdue`].filter(Boolean).join(" · ") || "All caught up");
  const shown = rows ? filterLoans(rows, { group, query: "" }, today) : [];
  const rowCounts = rows ? countGroups(rows, today) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Requests</h1>
          <p className="muted">{summary ?? "Loading requests"}</p>
        </div>
      </div>
      <Tabs
        tabs={[
          ["in", `Incoming (${incoming?.length ?? 0})`],
          ["mine", `My requests (${mine?.length ?? 0})`],
        ]}
        value={tab}
        onChange={setTab}
      />
      <div role="tabpanel" className="stack">
        {rows === undefined ? (
          <ListSkeleton rows={3} />
        ) : rows.length === 0 ? (
          <EmptyState title={tab === "in" ? "No requests yet" : "You haven't asked for anything yet"}>
            <Link href={tab === "in" ? "/listings" : "/tools"} className="btn btn-sm">
              {tab === "in" ? "List a tool" : "Browse tools"}
            </Link>
          </EmptyState>
        ) : (
          <>
            <FilterChips
              label="Filter by status"
              options={LOAN_GROUPS.map(([id, label]) => ({ id, label, count: rowCounts?.[id] }))}
              value={group}
              onChange={setGroup}
            />
            {shown.length ? (
              <div className="list stagger">
                <ListHeader variant="loan" columns={[tab === "in" ? "Tool and borrower" : "Tool and owner", "Dates", "Status", "Actions"]} />
                {shown.map((loan) => (
                  <LoanRow key={loan._id} loan={loan} side={tab} today={today} fresh={loan._creationTime > openedAt} />
                ))}
              </div>
            ) : (
              <EmptyState title="Nothing matches these filters">
                <Button size="sm" onClick={() => setGroup("all")}>
                  Clear filters
                </Button>
              </EmptyState>
            )}
          </>
        )}
      </div>
    </>
  );
}
