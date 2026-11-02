"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { api } from "@/convex/_generated/api";

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export default function InboxPage() {
  const notes = useQuery(api.notifications.mine);
  const markRead = useMutation(api.notifications.markRead);
  const [openedAt] = useState(() => Date.now());
  const [now] = useState(() => new Date());

  if (notes === undefined) return <ListSkeleton />;
  const unread = notes.filter((note) => !note.read).length;
  const groups = [
    { label: "Today", notes: notes.filter((note) => sameDay(new Date(note._creationTime), now)) },
    { label: "Earlier", notes: notes.filter((note) => !sameDay(new Date(note._creationTime), now)) },
  ].filter((group) => group.notes.length);

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div>
          <h1>Inbox</h1>
          <p className="muted">{unread} new</p>
        </div>
        <Button size="sm" disabled={!unread} onClick={() => markRead({})}>
          Mark all read
        </Button>
      </div>
      {groups.length === 0 && (
        <EmptyState title="Nothing here yet">
          <span className="muted">Requests, answers and reminders show up here.</span>
        </EmptyState>
      )}
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h2 className="group-h">{group.label}</h2>
          <ul className="plain list stagger">
            {group.notes.map((note) => {
              const created = new Date(note._creationTime);
              const classes = ["note-row", note.read && "read", note._creationTime > openedAt && "fresh"].filter(Boolean).join(" ");
              return (
                <li key={note._id} className={classes}>
                  <span className="dot" aria-hidden="true" />
                  <div className="note-body">
                    <span className="note-text">{note.message}</span>
                    <span className="sub">
                      {group.label === "Today"
                        ? created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : created.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <Link
                    href={note.kind === "automation_failed" ? "/admin" : "/requests"}
                    className="btn btn-quiet btn-sm"
                    onClick={() => !note.read && markRead({ id: note._id })}
                  >
                    View
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
