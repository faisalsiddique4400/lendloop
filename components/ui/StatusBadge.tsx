import type { DisplayStatus } from "@/convex/lib/dates";

const LOOK: Record<DisplayStatus, [label: string, className: string]> = {
  pending: ["Waiting", "badge badge-accent"],
  approved: ["Approved", "badge badge-strong"],
  overdue: ["Overdue", "badge badge-danger"],
  declined: ["Declined", "badge"],
  returned: ["Returned", "badge"],
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const [label, className] = LOOK[status];
  return <span className={className}>{label}</span>;
}
