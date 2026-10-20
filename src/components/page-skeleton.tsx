export function PageSkeleton() {
  return (
    <div className="animate-pulse pt-16" aria-busy="true" aria-label="Carregando">
      <div className="mb-6 h-9 w-44 rounded-lg bg-fill" />
      <div className="mb-7 h-40 rounded-xl bg-surface" />
      <div className="h-56 rounded-xl bg-surface" />
    </div>
  );
}
