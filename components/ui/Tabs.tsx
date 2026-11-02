export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: [id: T, label: string][];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={id === value}
          className={id === value ? "tab on" : "tab"}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
