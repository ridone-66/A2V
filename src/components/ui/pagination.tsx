import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageCount,
  basePath,
  params,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  params: Record<string, string | string[] | undefined>;
}) {
  if (pageCount <= 1) return null;

  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page" || value === undefined) continue;
      if (Array.isArray(value)) value.forEach((item) => item && search.append(key, item));
      else if (value) search.set(key, value);
    }
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
    (candidate) => candidate === 1 || candidate === pageCount || Math.abs(candidate - page) <= 1,
  );

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
      <Link
        href={href(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={cn(
          "inline-flex h-10 items-center gap-1 rounded-full border border-brand-200 px-3 text-sm font-medium",
          page === 1 ? "pointer-events-none opacity-40" : "hover:bg-brand-50",
        )}
      >
        <ChevronLeft className="h-4 w-4" /> Précédent
      </Link>
      {pages.map((candidate, index) => {
        const previous = pages[index - 1];
        return (
          <span key={candidate} className="flex items-center gap-1.5">
            {previous && candidate - previous > 1 ? <span className="px-1 text-muted">…</span> : null}
            <Link
              href={href(candidate)}
              aria-current={candidate === page ? "page" : undefined}
              className={cn(
                "inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-semibold",
                candidate === page
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-brand-200 bg-white text-ink hover:bg-brand-50",
              )}
            >
              {candidate}
            </Link>
          </span>
        );
      })}
      <Link
        href={href(Math.min(pageCount, page + 1))}
        aria-disabled={page === pageCount}
        className={cn(
          "inline-flex h-10 items-center gap-1 rounded-full border border-brand-200 px-3 text-sm font-medium",
          page === pageCount ? "pointer-events-none opacity-40" : "hover:bg-brand-50",
        )}
      >
        Suivant <ChevronRight className="h-4 w-4" />
      </Link>
    </nav>
  );
}
