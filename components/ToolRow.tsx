import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import { formatDay } from "@/convex/lib/dates";
import { Button } from "./ui/Button";

export type ListedTool = FunctionReturnType<typeof api.tools.list>[number];

export function ToolRow({ tool, onRequest }: { tool: ListedTool; onRequest: () => void }) {
  const status = tool.available ? "Available" : tool.overdue ? "Overdue" : `Back ${formatDay(tool.backOn!)}`;
  return (
    <div className="row">
      <div>
        <div className="t-name">{tool.name}</div>
        <div className="sub">
          {tool.category} · {tool.condition}
        </div>
      </div>
      <div className="who">
        <span>{tool.mine ? "You" : tool.ownerName}</span>
        {tool.ownerTrusted && <span className="badge badge-accent">Trusted</span>}
      </div>
      <div className={tool.available ? "" : "muted"}>{status}</div>
      <div className="actions">
        {tool.mine ? (
          <span className="sub">Yours</span>
        ) : (
          <Button size="sm" onClick={onRequest}>
            Request
          </Button>
        )}
      </div>
    </div>
  );
}
