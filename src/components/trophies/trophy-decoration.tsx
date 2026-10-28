import { cn } from "@/lib/utils";

/**
 * Grand trophée décoratif affiché sur les côtés de la page /trophees.
 *
 * - purement décoratif : `aria-hidden`, non focusable, `pointer-events-none` ;
 * - animé en CSS uniquement (aucun JavaScript côté client) ;
 * - les animations sont désactivées via `prefers-reduced-motion` (voir globals.css) ;
 * - masqué sous le breakpoint `xl` pour ne jamais provoquer de débordement horizontal.
 */
export function TrophyDecoration({ side, className }: { side: "left" | "right"; className?: string }) {
  const gradientId = `trophy-gold-${side}`;
  const cupId = `trophy-cup-${side}`;
  const glowId = `trophy-glow-${side}`;

  return (
    <div
      aria-hidden="true"
      data-trophy-decoration={side}
      className={cn(
        "pointer-events-none absolute top-1/2 hidden -translate-y-1/2 select-none xl:block",
        side === "left" ? "left-0" : "right-0",
        className,
      )}
    >
      <div className={cn("relative h-52 w-52", side === "left" ? "trophy-float" : "trophy-float-alt")}>
        <span className="trophy-glow absolute inset-6 rounded-full bg-brand-500/25 blur-3xl" />
        <svg
          viewBox="0 0 220 260"
          className="relative h-full w-full drop-shadow-[0_18px_28px_rgba(76,29,149,0.28)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={gradientId} x1="40" y1="30" x2="180" y2="220" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="45%" stopColor="#F4C142" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
            <linearGradient id={cupId} x1="110" y1="40" x2="110" y2="162" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="55%" stopColor="#6D28D9" />
              <stop offset="100%" stopColor="#4C1D95" />
            </linearGradient>
            <radialGradient id={glowId} cx="0.35" cy="0.15" r="0.9">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
              <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* ombre au sol */}
          <ellipse cx="110" cy="241" rx="62" ry="9" fill="#4C1D95" opacity="0.12" />

          {/* anses */}
          <path
            d="M52 62H36a24 24 0 0 0 0 48h10M168 62h16a24 24 0 0 1 0 48h-10"
            stroke={`url(#${gradientId})`}
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* coupe */}
          <path
            d="M48 38h124l-13 102c-2 12-11 20-23 20H84c-12 0-21-8-23-20L48 38Z"
            fill={`url(#${cupId})`}
            stroke="#DDD6FE"
            strokeOpacity="0.55"
            strokeWidth="2"
          />
          <path
            d="M48 38h124l-13 102c-2 12-11 20-23 20H84c-12 0-21-8-23-20L48 38Z"
            fill={`url(#${glowId})`}
          />

          {/* liseré supérieur */}
          <path d="M48 38h124" stroke="#F4C142" strokeWidth="7" strokeLinecap="round" />

          {/* étoile */}
          <path
            d="m110 68 8.2 17.1 18.8 2.6-13.7 13.1 3.3 18.6L110 110.6 93.4 119.4l3.3-18.6-13.7-13.1 18.8-2.6L110 68Z"
            fill="#FDE68A"
            stroke="#B45309"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* pied */}
          <path d="M98 160h24v26H98z" fill={`url(#${gradientId})`} />
          <rect x="72" y="186" width="76" height="16" rx="8" fill={`url(#${gradientId})`} />
          <rect x="58" y="201" width="104" height="17" rx="8.5" fill={`url(#${gradientId})`} />
          <rect x="58" y="201" width="104" height="6" rx="3" fill="#FDE68A" opacity="0.55" />

          {/* reflet */}
          <path d="M70 52c-2 34 2 58 10 78" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="6" strokeLinecap="round" />
        </svg>

        <span className="trophy-sparkle absolute -left-1 top-8 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-amber-300" />
        <span
          className="trophy-sparkle absolute right-0 top-20 h-2 w-2 rotate-45 rounded-[2px] bg-brand-300"
          style={{ animationDelay: "-1.1s" }}
        />
        <span
          className="trophy-sparkle absolute bottom-10 left-4 h-1.5 w-1.5 rotate-45 rounded-[2px] bg-amber-200"
          style={{ animationDelay: "-2.2s" }}
        />
        <span
          className="trophy-sparkle absolute -right-2 bottom-16 h-3 w-3 rotate-45 rounded-[2px] bg-brand-400"
          style={{ animationDelay: "-0.6s" }}
        />
      </div>
    </div>
  );
}
