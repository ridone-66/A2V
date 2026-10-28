import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
      <Link href="/" className="hover:text-brand-700">
        Accueil
      </Link>
      {items.map((item) => (
        <span key={`${item.label}-${item.href ?? ""}`} className="flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          {item.href ? (
            <Link href={item.href} className="hover:text-brand-700">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
