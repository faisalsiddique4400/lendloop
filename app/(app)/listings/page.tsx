"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { ToolForm, type MyTool } from "@/components/ToolForm";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useToastAction } from "@/components/ui/Toast";
import { api } from "@/convex/_generated/api";

export default function ListingsPage() {
  const tools = useQuery(api.tools.mine);
  const remove = useMutation(api.tools.remove);
  const run = useToastAction();
  const [editing, setEditing] = useState<MyTool | null>(null);

  async function del(tool: MyTool) {
    if (!window.confirm(`Delete the ${tool.name.toLowerCase()}? This can't be undone.`)) return;
    await run(() => remove({ toolId: tool._id }), `${tool.name} is gone from the list.`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My listings</h1>
          <p className="muted">Only you can edit or remove these.</p>
        </div>
      </div>
      <div className="split">
        <div>
          {tools === undefined ? (
            <ListSkeleton rows={3} />
          ) : tools.length ? (
            <div className="list stagger">
              {tools.map((tool) => (
                <div key={tool._id} className="row row-mine">
                  <div>
                    <div className="t-name">{tool.name}</div>
                    <div className="sub">
                      {tool.category} · {tool.condition}
                    </div>
                  </div>
                  <div className={tool.onLoan ? "muted" : ""}>{tool.status}</div>
                  <div className="actions">
                    <Button variant="quiet" size="sm" onClick={() => setEditing(tool)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" disabled={tool.onLoan} title={tool.onLoan ? "On loan right now" : undefined} onClick={() => del(tool)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing listed yet">
              <span className="muted">Add your first tool with the form.</span>
            </EmptyState>
          )}
          <p className="help help-gap">
            You can&apos;t delete a tool while someone has it.
          </p>
        </div>
        <ToolForm key={editing?._id ?? "new"} editing={editing} onDone={() => setEditing(null)} />
      </div>
    </>
  );
}
