"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { effectiveStatus, formatRange, localToday } from "@/convex/lib/dates";
import { errorText } from "@/lib/errors";

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
  const toast = useToast();
  const [tab, setTab] = useState<"loans" | "listings" | "people">("loans");
  const [today] = useState(localToday);

  if (me === undefined) return <ListSkeleton />;
  if (!isAdmin) {
    return (
      <EmptyState title="Admins only">
        <span className="muted">Ask an admin if you need access.</span>
      </EmptyState>
    );
  }

  const alert = notes?.find((note) => note.kind === "automation_failed" && !note.read);

  async function attempt(action: () => Promise<unknown>, done?: string) {
    try {
      await action();
      if (done) toast(done);
    } catch (err) {
      toast(errorText(err));
    }
  }

  async function remove(toolId: Id<"tools">, name: string) {
    if (!window.confirm(`Remove the ${name.toLowerCase()} for everyone? This can't be undone.`)) return;
    try {
      await removeTool({ toolId });
      toast(`${name} removed.`);
    } catch (err) {
      toast(errorText(err));
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Admin</h1>
      </div>

      {alert && (
        <div className="notice notice-danger" role="alert">
          <span>{alert.message}</span>
          <Button variant="quiet" size="sm" onClick={() => attempt(() => markRead({ id: alert._id }))}>
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

      <div className="scroll" role="tabpanel">
        {tab === "loans" &&
          (loans ? (
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
                {loans.map((loan) => (
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
          ) : (
            <ListSkeleton />
          ))}

        {tab === "listings" &&
          (tools ? (
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
                {tools.map((tool) => (
                  <tr key={tool._id}>
                    <td className="t-name">{tool.name}</td>
                    <td>{tool.ownerName}</td>
                    <td>{tool.category}</td>
                    <td style={{ textAlign: "right" }}>
                      <Button variant="danger" size="sm" onClick={() => remove(tool._id, tool.name)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ListSkeleton />
          ))}

        {tab === "people" &&
          (people ? (
            <table className="data">
              <thead>
                <tr>
                  <th>Neighbor</th>
                  <th>Tools listed</th>
                  <th>Trusted Lender</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person._id}>
                    <td className="t-name">{person.name}</td>
                    <td>{person.tools}</td>
                    <td>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={person.trusted}
                          onChange={(e) =>
                            attempt(
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
          ) : (
            <ListSkeleton />
          ))}
      </div>
    </>
  );
}
