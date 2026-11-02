"use client";

import { useMutation } from "convex/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import { addDays, daysBetween, formatRange, localToday, overlaps, plural, presets } from "@/convex/lib/dates";
import { errorText } from "@/lib/errors";
import type { ListedTool } from "./ToolRow";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { useToast } from "./ui/Toast";

export function RequestDialog({ tool, onClose }: { tool: ListedTool; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [today] = useState(localToday);
  const [startDate, setStartDate] = useState(addDays(today, 1));
  const [endDate, setEndDate] = useState(addDays(today, 2));
  const [serverError, setServerError] = useState("");
  const [sending, setSending] = useState(false);
  const request = useMutation(api.loans.request);
  const toast = useToast();

  useEffect(() => dialog.current?.showModal(), []);

  const pick = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setServerError("");
  };
  const clash = tool.booked.some((booking) => overlaps(booking, { startDate, endDate }));
  const error =
    !startDate || !endDate
      ? "Pick both dates."
      : endDate < startDate
        ? "The end date is before the start."
        : clash
          ? "Those days are taken. Try others."
          : serverError;

  async function send(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    try {
      await request({ toolId: tool._id, startDate, endDate });
      toast(`Request sent. ${tool.ownerName.split(" ")[0]} gets a notice now.`);
      dialog.current?.close();
    } catch (err) {
      setServerError(errorText(err));
      setSending(false);
    }
  }

  return (
    <dialog ref={dialog} className="panel dialog" aria-labelledby="req-h" onClose={onClose}>
      <form className="form" onSubmit={send}>
        <div>
          <h2 id="req-h">Borrow the {tool.name.toLowerCase()}</h2>
          <p className="sub">From {tool.ownerName}. They&apos;ll get a notice right away.</p>
        </div>
        <div className="presets" role="group" aria-label="Quick dates">
          {presets(today).map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={preset.startDate === startDate && preset.endDate === endDate ? "chip on" : "chip"}
              onClick={() => pick(preset.startDate, preset.endDate)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="two">
          <Field id="from" label="From" invalid={!!error}>
            <input id="from" type="date" value={startDate} min={today} onChange={(e) => pick(e.target.value, endDate)} aria-describedby="date-msg" aria-invalid={!!error} />
          </Field>
          <Field id="to" label="To" invalid={!!error}>
            <input id="to" type="date" value={endDate} min={startDate} onChange={(e) => pick(startDate, e.target.value)} aria-describedby="date-msg" aria-invalid={!!error} />
          </Field>
        </div>
        <div id="date-msg" className="span-note" aria-live="polite">
          {error ? <span className="err-text">{error}</span> : <span className="muted">{plural(daysBetween(startDate, endDate) + 1, "day")}</span>}
          <span className="muted">
            {tool.booked.length ? `Booked ${tool.booked.map((b) => formatRange(b.startDate, b.endDate)).join(", ")}` : "No bookings yet"}
          </span>
        </div>
        <div className="actions">
          <Button variant="quiet" onClick={() => dialog.current?.close()}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!!error || sending}>
            Send request
          </Button>
        </div>
      </form>
    </dialog>
  );
}
