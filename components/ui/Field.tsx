import type { ReactNode } from "react";

type Props = { id: string; label: string; error?: string; help?: ReactNode; invalid?: boolean; children: ReactNode };

export function Field({ id, label, error, help, invalid, children }: Props) {
  const message = error || help;
  return (
    <div className={error || invalid ? "field err" : "field"}>
      <label htmlFor={id}>{label}</label>
      {children}
      {message && (
        <span id={`${id}-msg`} className={error ? "err-text" : "help"}>
          {message}
        </span>
      )}
    </div>
  );
}
