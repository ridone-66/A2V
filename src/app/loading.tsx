export default function Loading() {
  return (
    <div className="container-page py-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement de la page…</span>
      <div className="h-4 w-32 animate-pulse rounded bg-brand-100" />
      <div className="mt-3 h-9 w-2/3 max-w-md animate-pulse rounded bg-brand-100" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="card overflow-hidden">
            <div className="aspect-[4/3] animate-pulse bg-brand-50" />
            <div className="space-y-3 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-brand-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-brand-50" />
              <div className="h-5 w-1/3 animate-pulse rounded bg-brand-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
