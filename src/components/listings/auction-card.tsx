import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Countdown } from "@/components/auctions/countdown";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function AuctionCard({
  href,
  title,
  image,
  currentPriceCents,
  bidCount,
  endsAt,
  status,
  reservePriceCents,
  buyNowPriceCents,
  premiumOnly,
  seller,
  className,
}: {
  href: string;
  title: string;
  image?: string | null;
  currentPriceCents: number;
  bidCount: number;
  endsAt: Date | string;
  status: string;
  reservePriceCents?: number | null;
  buyNowPriceCents?: number | null;
  premiumOnly?: boolean;
  seller?: string;
  className?: string;
}) {
  const ended = new Date(endsAt).getTime() <= Date.now();
  return (
    <article className={cn("card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-soft", className)}>
      <Link href={href} className="block">
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
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-300 text-4xl">🔨</div>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {premiumOnly ? <Badge tone="brand">✦ Prestige</Badge> : null}
            {status === "LIVE" && !ended ? <Badge tone="success">● En direct</Badge> : null}
            {status === "SCHEDULED" ? <Badge tone="info">À venir</Badge> : null}
            {ended || !["LIVE", "SCHEDULED"].includes(status) ? <Badge tone="neutral">Terminée</Badge> : null}
          </div>
        </div>
        <div className="p-4">
          <h3 className="line-clamp-2 min-h-[2.6rem] text-[15px] font-semibold leading-snug text-ink group-hover:text-brand-700">
            {title}
          </h3>
          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted">Prix actuel</p>
              <p className="text-lg font-bold text-brand-700">{formatMoney(currentPriceCents)}</p>
            </div>
            <p className="text-xs text-muted">{bidCount} offre{bidCount > 1 ? "s" : ""}</p>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <span className="text-muted">{seller ? seller : "A2V"}</span>
            {status === "LIVE" && !ended ? (
              <Countdown endsAt={new Date(endsAt).toISOString()} status={status} compact className="font-semibold text-brand-700" />
            ) : (
              <span className="font-medium text-muted">Terminée</span>
            )}
          </div>
          {reservePriceCents ? (
            <p className="mt-1 text-[11px] text-muted">
              {currentPriceCents >= reservePriceCents ? "Réserve atteinte" : "Réserve non atteinte"}
            </p>
          ) : null}
          {buyNowPriceCents ? (
            <p className="mt-1 text-[11px] text-muted">Achat immédiat : {formatMoney(buyNowPriceCents)}</p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
