"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { LoanRow } from "@/components/LoanRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { api } from "@/convex/_generated/api";
import { effectiveStatus, todayIso } from "@/convex/lib/dates";

export default function RequestsPage() {
  const incoming = useQuery(api.loans.incoming);
  const mine = useQuery(api.loans.mine);
  const [tab, setTab] = useState<"in" | "mine">("in");
  const [openedAt] = useState(() => Date.now());
  const [today] = useState(todayIso);

  const rows = tab === "in" ? incoming : mine;
  const waiting = incoming?.filter((loan) => loan.status === "pending").length ?? 0;
  const late = incoming?.filter((loan) => effectiveStatus(loan, today) === "overdue").length ?? 0;
  const summary = [waiting && `${waiting} waiting on you`, late && `${late} overdue`].filter(Boolean).join(" · ") || "All caught up";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Requests</h1>
          <p className="muted">{incoming ? summary : "Loading requests"}</p>
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
      <div role="tabpanel">
        {rows === undefined ? (
          <ListSkeleton rows={3} />
        ) : rows.length ? (
          <div className="list stagger">
            {rows.map((loan) => (
              <LoanRow key={loan._id} loan={loan} side={tab} today={today} fresh={loan._creationTime > openedAt} />
            ))}
          </div>
        ) : (
          <EmptyState title={tab === "in" ? "No requests yet" : "You haven't asked for anything yet"}>
            <Link href={tab === "in" ? "/listings" : "/tools"} className="btn btn-sm">
              {tab === "in" ? "List a tool" : "Browse tools"}
            </Link>
          </EmptyState>
        )}
      </div>
    </>
  );
}
