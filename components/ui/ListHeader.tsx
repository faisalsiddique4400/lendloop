export function ListHeader({ columns, variant }: { columns: string[]; variant?: "loan" | "mine" }) {
  return (
    <div className={["row", "row-head", variant && `row-${variant}`].filter(Boolean).join(" ")} aria-hidden="true">
      {columns.map((column, i) => (
        <span key={i} className={i === columns.length - 1 && i > 0 ? "cell-end" : undefined}>
          {column}
        </span>
      ))}
    </div>
  );
}
