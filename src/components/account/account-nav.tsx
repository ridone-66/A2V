"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  Bell,
  CreditCard,
  Gavel,
  Gem,
  Heart,
  HeartHandshake,
  Home,
  LayoutList,
  MessageCircle,
  Package,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trophy,
  Truck,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const GROUPS: Array<{
  title: string;
  items: Array<{ href: string; label: string; icon: typeof Home; badge?: number; premiumOnly?: boolean }>;
}> = [
  {
    title: "Activité",
    items: [
      { href: "/compte", label: "Vue d'ensemble", icon: Home },
      { href: "/compte/achats", label: "Mes achats", icon: ShoppingBag },
      { href: "/compte/ventes", label: "Mes ventes", icon: Package },
      { href: "/compte/encheres", label: "Mes enchères", icon: Gavel },
      { href: "/compte/annonces", label: "Mes annonces", icon: LayoutList },
    ],
  },
  {
    title: "Suivi",
    items: [
      { href: "/compte/messages", label: "Messages", icon: MessageCircle },
      { href: "/compte/notifications", label: "Notifications", icon: Bell },
      { href: "/compte/livraisons", label: "Livraisons", icon: Truck },
      { href: "/compte/transactions", label: "Transactions", icon: ReceiptText },
    ],
  },
  {
    title: "Avantages",
    items: [
      { href: "/compte/favoris", label: "Favoris", icon: Heart },
      { href: "/compte/trophees", label: "Trophées", icon: Trophy },
      { href: "/compte/reductions", label: "Réductions", icon: BadgePercent },
      { href: "/compte/abonnement", label: "Abonnement Prestige", icon: Sparkles },
      { href: "/premium/offres", label: "Offres Prestige", icon: Gem, premiumOnly: true },
      { href: "/compte/dons", label: "Mes dons", icon: HeartHandshake },
    ],
  },
  {
    title: "Compte",
    items: [
      { href: "/compte/profil", label: "Profil public", icon: UserRound },
      { href: "/compte/parametres", label: "Paramètres", icon: CreditCard },
      { href: "/compte/securite", label: "Sécurité", icon: ShieldCheck },
      { href: "/compte/confidentialite", label: "Mes données (RGPD)", icon: ShieldCheck },
    ],
  },
];

export function AccountNav({ isPremium = false }: { isPremium?: boolean }) {
  const pathname = usePathname();
  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.premiumOnly || isPremium),
  }));

  return (
    <nav aria-label="Navigation du compte" className="space-y-6">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{group.title}</p>
          <ul className="mt-2 space-y-0.5">
            {group.items.map((item) => {
              const active = item.href === "/compte" ? pathname === "/compte" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium",
                      active ? "bg-brand-100 text-brand-900" : "text-muted hover:bg-brand-50 hover:text-ink",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active ? "text-brand-700" : "text-brand-400")} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
