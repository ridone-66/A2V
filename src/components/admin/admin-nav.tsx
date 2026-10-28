"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeEuro,
  BarChart3,
  Boxes,
  FileClock,
  Flag,
  Gavel,
  HeartHandshake,
  LayoutDashboard,
  MessageSquareWarning,
  Settings,
  ShoppingCart,
  Tags,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/auth/permissions";

const GROUPS: Array<{
  title: string;
  items: Array<{ href: string; label: string; icon: typeof LayoutDashboard; permission?: Permission }>;
}> = [
  {
    title: "Pilotage",
    items: [
      { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, permission: "stats.read" },
      { href: "/admin/audit", label: "Journal d'audit", icon: FileClock, permission: "audit.read" },
    ],
  },
  {
    title: "Communauté",
    items: [
      { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users, permission: "users.read" },
      { href: "/admin/annonces", label: "Annonces", icon: Boxes, permission: "listings.moderate" },
      { href: "/admin/signalements", label: "Signalements", icon: Flag, permission: "reports.manage" },
      { href: "/admin/messages", label: "Messages signalés", icon: MessageSquareWarning, permission: "reports.manage" },
    ],
  },
  {
    title: "Transactions",
    items: [
      { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart, permission: "orders.manage" },
      { href: "/admin/encheres", label: "Enchères", icon: Gavel, permission: "auctions.manage" },
      { href: "/admin/litiges", label: "Litiges", icon: BadgeEuro, permission: "disputes.manage" },
      { href: "/admin/dons", label: "Dons & solidarité", icon: HeartHandshake, permission: "donations.manage" },
    ],
  },
  {
    title: "Configuration",
    items: [
      { href: "/admin/categories", label: "Catégories", icon: Tags, permission: "categories.manage" },
      { href: "/admin/parametres", label: "Paramètres", icon: Settings, permission: "settings.manage" },
      { href: "/admin/statistiques", label: "Statistiques", icon: BarChart3, permission: "stats.read" },
    ],
  },
];

export function AdminNav({ permissions }: { permissions: Permission[] }) {
  const pathname = usePathname();
  const allowed = new Set(permissions);

  return (
    <nav aria-label="Navigation administration" className="space-y-6">
      {GROUPS.map((group) => {
        const items = group.items.filter((item) => !item.permission || allowed.has(item.permission));
        if (items.length === 0) return null;
        return (
          <div key={group.title}>
            <p className="px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{group.title}</p>
            <ul className="mt-2 space-y-0.5">
              {items.map((item) => {
                const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
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
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
