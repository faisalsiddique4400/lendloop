export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel" />
      ))}
    </div>
  );
}
