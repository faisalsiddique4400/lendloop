"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { effectiveStatus, formatRange, timingLabel } from "@/convex/lib/dates";
import { errorText } from "@/lib/errors";
import { Button } from "./ui/Button";
import { StatusBadge } from "./ui/StatusBadge";
import { useToast } from "./ui/Toast";

export type NamedLoan = FunctionReturnType<typeof api.loans.incoming>[number];

type Props = { loan: NamedLoan; side: "in" | "mine"; today: string; fresh: boolean };

export function LoanRow({ loan, side, today, fresh }: Props) {
  const decide = useMutation(api.loans.decide);
  const markReturned = useMutation(api.loans.markReturned);
  const remind = useMutation(api.loans.remind);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [reminded, setReminded] = useState(false);

  const status = effectiveStatus(loan, today);
  const other = side === "in" ? loan.borrowerName : loan.ownerName;
  const first = other.split(" ")[0];

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      toast(done);
    } catch (err) {
      toast(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={fresh ? "row row-loan fresh" : "row row-loan"}>
      <div>
        <div className="t-name">{loan.toolName}</div>
        <div className="sub">{side === "mine" ? `From ${other}` : status === "pending" ? `${other} wants it` : other}</div>
      </div>
      <div>
        <div className="mono">{formatRange(loan.startDate, loan.endDate)}</div>
        <div className={status === "overdue" ? "due late" : "due"}>{timingLabel(loan, today)}</div>
      </div>
      <div>
        <StatusBadge status={status} />
      </div>
      <div className="actions">
        {side === "in" && status === "pending" && (
          <>
            <Button size="sm" disabled={busy} onClick={() => run(() => decide({ loanId: loan._id, approve: false }), `Declined. ${first} gets a notice now.`)}>
              Decline
            </Button>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => decide({ loanId: loan._id, approve: true }), `Approved. ${first} gets a notice now.`)}>
              Approve
            </Button>
          </>
        )}
        {side === "in" && status === "overdue" && (
          <Button
            size="sm"
            disabled={busy || reminded}
            onClick={() =>
              run(async () => {
                await remind({ loanId: loan._id });
                setReminded(true);
              }, `Reminder sent to ${first}. You can send one a day.`)
            }
          >
            {reminded ? "Reminder sent" : "Send reminder"}
          </Button>
        )}
        {side === "in" && (status === "approved" || status === "overdue") && (
          <Button size="sm" disabled={busy} onClick={() => run(() => markReturned({ loanId: loan._id }), "Marked returned. Thanks for lending.")}>
            Mark returned
          </Button>
        )}
      </div>
    </div>
  );
}
