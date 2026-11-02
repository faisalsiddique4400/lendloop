import type { Ref } from "react";

type Props = { id: string; label: string; value: string; onChange: (value: string) => void; inputRef?: Ref<HTMLInputElement>; shortcut?: string };

export function SearchBox({ id, label, value, onChange, inputRef, shortcut }: Props) {
  return (
    <div className="search">
      <label htmlFor={id} className="sr">
        {label}
      </label>
      <input id={id} ref={inputRef} type="search" placeholder={label} value={value} onChange={(e) => onChange(e.target.value)} />
      {shortcut && (
        <kbd className="kbd" aria-hidden="true">
          {shortcut}
        </kbd>
      )}
    </div>
  );
}
