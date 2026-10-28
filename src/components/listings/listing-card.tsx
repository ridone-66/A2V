import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { LISTING_CONDITIONS } from "@/lib/config";
import { cn } from "@/lib/utils";

export function conditionLabel(value: string) {
  return LISTING_CONDITIONS.find((condition) => condition.value === value)?.label ?? value;
}

export function ListingCard({
  href,
  title,
  image,
  priceCents,
  condition,
  location,
  seller,
  premiumOnly,
  badge,
  footer,
  className,
}: {
  href: string;
  title: string;
  image?: string | null;
  priceCents: number;
  condition?: string;
  location?: string | null;
  seller?: string;
  premiumOnly?: boolean;
  badge?: string;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("group card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-soft", className)}>
      <Link href={href} className="block focus-visible:outline-none">
        <div className="relative aspect-[4/3] overflow-hidden bg-brand-50">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-300 text-4xl text-brand-700">
              🛍️
            </div>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {premiumOnly ? <Badge tone="brand">✦ Prestige</Badge> : null}
            {badge ? <Badge tone="neutral">{badge}</Badge> : null}
          </div>
        </div>
        <div className="p-4">
          <h3 className="line-clamp-2 min-h-[2.6rem] text-[15px] font-semibold leading-snug text-ink group-hover:text-brand-700">
            {title}
          </h3>
          <p className="mt-2 text-lg font-bold text-ink">{formatMoney(priceCents)}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
            {condition ? <span>{conditionLabel(condition)}</span> : null}
            {location ? <span>· {location}</span> : null}
            {seller ? <span>· {seller}</span> : null}
          </p>
          {footer ? <div className="mt-3">{footer}</div> : null}
        </div>
      </Link>
    </article>
  );
}
