import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheck, Gavel, ShieldCheck, Sparkles } from "lucide-react";
import { PREMIUM, trialOfferLabel } from "@/lib/config";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-[calc(100vh-5rem)] lg:grid-cols-[1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-brand-800 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(167,139,250,0.5),transparent_55%),radial-gradient(circle_at_10%_90%,rgba(76,29,149,0.9),transparent_45%)]" />
        <div className="relative">
          <Link href="/" className="text-3xl font-extrabold tracking-tight">A2V</Link>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-brand-200">Marketplace française</p>
          <h2 className="mt-10 max-w-md text-balance text-3xl font-bold leading-tight text-orange-400">
            Achetez, vendez et enchérissez en toute clarté.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-brand-100">
            Publiez gratuitement. Une commission de 0,5 % seulement sur une vente finalisée. Pas de frais cachés, conditions
            d&apos;abonnement affichées avant activation.
          </p>
        </div>
        <ul className="relative space-y-4 text-sm">
          {[
            { icon: ShieldCheck, text: "Paiement protégé jusqu'à la réception" },
            { icon: Gavel, text: "Enchères avec horloge serveur et anti-sniping" },
            { icon: Sparkles, text: `Prestige : ${trialOfferLabel(PREMIUM.trialDays)}, engagement de ${PREMIUM.commitmentMonths} mois` },
            { icon: BadgeCheck, text: "Trophées après une vente réellement finalisée" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.text} className="flex items-center gap-2.5 text-brand-100">
                <Icon className="h-4 w-4 text-brand-300" /> {item.text}
              </li>
            );
          })}
        </ul>
        <p className="relative text-xs text-brand-200">
          Environnement de démonstration : paiements et étiquettes simulés lorsque les prestataires ne sont pas configurés.
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <Link href="/" className="text-2xl font-extrabold text-brand-700">A2V</Link>
          </div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-6 text-sm text-muted">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
