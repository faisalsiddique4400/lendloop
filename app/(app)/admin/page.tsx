"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { SearchBox } from "@/components/ui/SearchBox";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import { useToastAction } from "@/components/ui/Toast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { effectiveStatus, formatRange, todayIso } from "@/convex/lib/dates";
import { CATEGORIES } from "@/convex/lib/validators";
import { countGroups, filterLoans, LOAN_GROUPS, type LoanGroup } from "@/lib/filterLoans";

const matches = (query: string, ...texts: string[]) => {
  const q = query.trim().toLowerCase();
  return !q || texts.some((text) => text.toLowerCase().includes(q));
};

export default function AdminPage() {
  const me = useQuery(api.users.me);
  const isAdmin = me?.role === "admin";
  const loans = useQuery(api.loans.all, isAdmin ? {} : "skip");
  const tools = useQuery(api.tools.list, isAdmin ? {} : "skip");
  const people = useQuery(api.users.list, isAdmin ? {} : "skip");
  const notes = useQuery(api.notifications.mine);
  const markRead = useMutation(api.notifications.markRead);
  const removeTool = useMutation(api.tools.remove);
  const setTrusted = useMutation(api.users.setTrusted);
  const run = useToastAction();
  const [tab, setTab] = useState<"loans" | "listings" | "people">("loans");
  const [today] = useState(todayIso);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<LoanGroup>("all");
  const [category, setCategory] = useState("All");
  const [onlyTrusted, setOnlyTrusted] = useState(false);

  if (me === undefined) return <ListSkeleton />;
  if (!isAdmin) {
    return (
      <EmptyState title="Admins only">
        <span className="muted">Ask an admin if you need access.</span>
      </EmptyState>
    );
  }

  const alert = notes?.find((note) => note.kind === "automation_failed" && !note.read);

  const clear = () => {
    setQuery("");
    setGroup("all");
    setCategory("All");
    setOnlyTrusted(false);
  };
  const noMatch = (
    <EmptyState title="Nothing matches these filters">
      <Button size="sm" onClick={clear}>
        Clear filters
      </Button>
    </EmptyState>
  );
  const shownLoans = loans && filterLoans(loans, { group, query }, today);
  const shownTools = tools?.filter((tool) => (category === "All" || tool.category === category) && matches(query, tool.name, tool.ownerName));
  const shownPeople = people?.filter((person) => (!onlyTrusted || person.trusted) && matches(query, person.name));
  const counts = loans && countGroups(loans, today);

  async function remove(toolId: Id<"tools">, name: string) {
    if (!window.confirm(`Remove the ${name.toLowerCase()} for everyone? This can't be undone.`)) return;
    await run(() => removeTool({ toolId }), `${name} removed.`);
  }

  return (
    <>
      <div className="page-head">
        <h1>Admin</h1>
      </div>

      {alert && (
        <div className="notice notice-danger" role="alert">
          <span>{alert.message}</span>
          <Button variant="quiet" size="sm" onClick={() => run(() => markRead({ id: alert._id }))}>
            Dismiss
          </Button>
        </div>
      )}

      <Tabs
        tabs={[
          ["loans", "All loans"],
          ["listings", "Listings"],
          ["people", "Neighbors"],
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="toolbar">
        <SearchBox
          id="admin-q"
          label={tab === "loans" ? "Search tool or neighbor" : tab === "listings" ? "Search tool or owner" : "Search neighbors"}
          value={query}
          onChange={setQuery}
        />
        {tab === "listings" && (
          <>
            <label className="sr" htmlFor="admin-cat">
              Category
            </label>
            <select id="admin-cat" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {["All", ...CATEGORIES].map((name) => (
                <option key={name} value={name}>
                  {name === "All" ? "All categories" : name}
                </option>
              ))}
            </select>
          </>
        )}
        {tab === "people" && (
          <label className="switch">
            <input type="checkbox" checked={onlyTrusted} onChange={(e) => setOnlyTrusted(e.target.checked)} /> Trusted only
          </label>
        )}
      </div>
      {tab === "loans" && counts && (
        <FilterChips
          label="Filter by status"
          options={LOAN_GROUPS.map(([id, label]) => ({ id, label, count: counts[id] }))}
          value={group}
          onChange={setGroup}
        />
      )}

      <div className="scroll" role="tabpanel">
        {tab === "loans" &&
          (shownLoans === undefined ? (
            <ListSkeleton />
          ) : shownLoans.length === 0 ? (
            noMatch
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Lender</th>
                  <th>Borrower</th>
                  <th>Dates</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {shownLoans.map((loan) => (
                  <tr key={loan._id}>
                    <td className="t-name">{loan.toolName}</td>
                    <td>{loan.ownerName}</td>
                    <td>{loan.borrowerName}</td>
                    <td className="mono">{formatRange(loan.startDate, loan.endDate)}</td>
                    <td>
                      <StatusBadge status={effectiveStatus(loan, today)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}

        {tab === "listings" &&
          (shownTools === undefined ? (
            <ListSkeleton />
          ) : shownTools.length === 0 ? (
            noMatch
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Owner</th>
                  <th>Category</th>
                  <th>
                    <span className="sr">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shownTools.map((tool) => (
                  <tr key={tool._id}>
                    <td className="t-name">{tool.name}</td>
                    <td>{tool.ownerName}</td>
                    <td>{tool.category}</td>
                    <td className="cell-end">
                      <Button variant="danger" size="sm" onClick={() => remove(tool._id, tool.name)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}

        {tab === "people" &&
          (shownPeople === undefined ? (
            <ListSkeleton />
          ) : shownPeople.length === 0 ? (
            noMatch
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Neighbor</th>
                  <th>Tools listed</th>
                  <th>Trusted Lender</th>
                </tr>
              </thead>
              <tbody>
                {shownPeople.map((person) => (
                  <tr key={person._id}>
                    <td className="t-name">{person.name}</td>
                    <td>{person.tools}</td>
                    <td>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={person.trusted}
                          onChange={(e) =>
                            run(
                              () => setTrusted({ userId: person._id, trusted: e.target.checked }),
                              `${person.name} is ${e.target.checked ? "now" : "no longer"} a Trusted Lender.`,
                            )
                          }
                        />
                        {person.trusted ? "Yes" : "No"}
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </div>
    </>
  );
}
