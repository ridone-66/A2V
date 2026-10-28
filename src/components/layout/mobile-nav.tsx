"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Search, ShoppingBag, Gavel, PlusCircle, User, Heart, Bell, MessageCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; badge?: number };

export function MobileNav({
  items,
  isAuthenticated,
  unreadNotifications,
  unreadMessages,
}: {
  items: NavItem[];
  isAuthenticated: boolean;
  unreadNotifications: number;
  unreadMessages: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full p-2 text-ink hover:bg-brand-50 lg:hidden"
        aria-label="Ouvrir le menu"
        aria-expanded={open}
      >
        <Menu className="h-6 w-6" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-2xl font-extrabold text-brand-700" onClick={() => setOpen(false)}>
                A2V
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 hover:bg-brand-50"
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form action="/catalogue" className="mt-5">
              <label htmlFor="mobile-search" className="sr-only">
                Rechercher
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input id="mobile-search" name="q" placeholder="Rechercher un article…" className="input pl-9" />
              </div>
            </form>

            <nav className="mt-6 flex-1 space-y-1" aria-label="Navigation principale">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-medium text-ink hover:bg-brand-50"
                >
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">{item.badge}</span>
                  ) : null}
                </Link>
              ))}
            </nav>

            <div className="mt-4 space-y-2 border-t border-brand-100 pt-4">
              <Link href="/compte/messages" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted">
                <MessageCircle className="h-4 w-4" /> Messages {unreadMessages ? `(${unreadMessages})` : ""}
              </Link>
              <Link href="/compte/notifications" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted">
                <Bell className="h-4 w-4" /> Notifications {unreadNotifications ? `(${unreadNotifications})` : ""}
              </Link>
              <Link href="/compte/favoris" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted">
                <Heart className="h-4 w-4" /> Favoris
              </Link>
              {isAuthenticated ? (
                <ButtonLink href="/compte" className="mt-2 w-full" onClick={() => setOpen(false)}>
                  <User className="h-4 w-4" /> Mon compte
                </ButtonLink>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <ButtonLink href="/connexion" variant="outline" onClick={() => setOpen(false)}>
                    Connexion
                  </ButtonLink>
                  <ButtonLink href="/inscription" onClick={() => setOpen(false)}>
                    S&apos;inscrire
                  </ButtonLink>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav isAuthenticated={isAuthenticated} />
    </>
  );
}

export function BottomNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const links = [
    { href: "/", label: "Accueil", icon: ShoppingBag },
    { href: "/encheres", label: "Enchères", icon: Gavel },
    { href: "/vendre", label: "Vendre", icon: PlusCircle, highlight: true },
    { href: "/catalogue", label: "Explorer", icon: Search },
    { href: isAuthenticated ? "/compte" : "/connexion", label: "Compte", icon: User },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Navigation mobile"
    >
      <div className="grid grid-cols-5">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-medium",
                link.highlight ? "text-brand-700" : "text-muted hover:text-brand-700",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  link.highlight ? "bg-brand-600 text-white shadow-sm" : "",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
