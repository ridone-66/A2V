import Link from "next/link";
import { Bell, Heart, MessageCircle, Search, ShoppingBag, User, Gavel, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPremium } from "@/lib/services/premium";
import { paymentsSimulationEnabled, shippingSimulation } from "@/lib/env";
import { Avatar } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { logoutAction } from "@/app/actions/auth";

async function loadHeaderData() {
  const user = await getCurrentUser();
  const [categories, unreadNotifications, unreadMessages, favorites, isPremium] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { position: "asc" },
      include: { children: { where: { isActive: true }, orderBy: { position: "asc" } } },
    }),
    user ? prisma.notification.count({ where: { userId: user.id, readAt: null } }) : Promise.resolve(0),
    user
      ? prisma.message.count({
          where: { readAt: null, senderId: { not: user.id }, conversation: { participants: { some: { userId: user.id } } } },
        })
      : Promise.resolve(0),
    user ? prisma.favorite.count({ where: { userId: user.id } }) : Promise.resolve(0),
    user ? hasPremium(user.id) : Promise.resolve(false),
  ]);
  return { user, categories, unreadNotifications, unreadMessages, favorites, isPremium };
}

export async function SiteHeader() {
  const { user, categories, unreadNotifications, unreadMessages, favorites, isPremium } = await loadHeaderData();

  const mobileItems = [
    { href: "/catalogue", label: "Acheter" },
    { href: "/encheres", label: "Enchères" },
    { href: "/vendre", label: "Vendre gratuitement" },
    { href: "/premium", label: "A2V Prestige" },
    { href: "/trophees", label: "Trophées & réductions" },
    { href: "/solidarite", label: "Solidarité" },
    { href: "/faq", label: "Aide & FAQ" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur">
      {paymentsSimulationEnabled || shippingSimulation ? (
        <div className="bg-brand-800 px-4 py-1.5 text-center text-[11px] font-medium text-brand-100 sm:text-xs">
          Environnement de démonstration — paiements simulés et étiquettes de livraison fictives. Aucun fonds réel n&apos;est prélevé.
        </div>
      ) : null}

      <div className="container-page">
        <div className="flex h-16 items-center gap-3 lg:h-20 lg:gap-6">
          <MobileNav
            items={mobileItems}
            isAuthenticated={Boolean(user)}
            unreadNotifications={unreadNotifications}
            unreadMessages={unreadMessages}
          />

          <Link href="/" className="shrink-0" aria-label="A2V — Accueil">
            <span className="text-[26px] font-extrabold tracking-tight text-brand-700 lg:text-3xl">A2V</span>
            <span className="ml-1 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted sm:inline">
              Marketplace
            </span>
          </Link>

          <form action="/catalogue" className="hidden flex-1 md:block" role="search">
            <label htmlFor="header-search" className="sr-only">
              Rechercher sur A2V
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="header-search"
                name="q"
                type="search"
                placeholder="Rechercher un article, une marque, une catégorie…"
                className="h-11 w-full rounded-full border border-brand-200 bg-brand-50/60 pl-11 pr-32 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
              />
              <button
                type="submit"
                className="absolute right-1 top-1 h-9 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Rechercher
              </button>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <Link
              href="/vendre"
              className="hidden rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 sm:inline-flex lg:hidden"
            >
              Vendre
            </Link>
            <IconLink href="/compte/messages" label="Messages" count={unreadMessages}>
              <MessageCircle className="h-5 w-5" />
            </IconLink>
            <IconLink href="/compte/notifications" label="Notifications" count={unreadNotifications}>
              <Bell className="h-5 w-5" />
            </IconLink>
            <IconLink href="/compte/favoris" label="Favoris" count={favorites}>
              <Heart className="h-5 w-5" />
            </IconLink>

            {user ? (
              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full p-1.5 hover:bg-brand-50 [&::-webkit-details-marker]:hidden">
                  <Avatar name={user.publicName} src={user.profile?.avatarUrl} size={34} />
                  <span className="hidden max-w-[110px] truncate text-sm font-medium text-ink xl:block">{user.publicName}</span>
                </summary>
                <div className="absolute right-0 top-12 w-64 rounded-2xl border border-brand-100 bg-white p-2 shadow-soft">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold text-ink">{user.publicName}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <div className="my-1 border-t border-brand-100" />
                  {[
                    ["Tableau de bord", "/compte"],
                    ["Mes achats", "/compte/achats"],
                    ["Mes ventes", "/compte/ventes"],
                    ["Mes enchères", "/compte/encheres"],
                    ["Mes trophées", "/compte/trophees"],
                    ...(isPremium ? [["Offres Prestige", "/premium/offres"] as [string, string]] : []),
                    ["Mon abonnement", "/compte/abonnement"],
                    ["Paramètres", "/compte/parametres"],
                  ].map(([label, href]) => (
                    <Link key={href} href={href} className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-brand-50">
                      {label}
                    </Link>
                  ))}
                  {user.role !== "USER" ? (
                    <>
                      <div className="my-1 border-t border-brand-100" />
                      <Link href="/admin" className="block rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                        Administration
                      </Link>
                    </>
                  ) : null}
                  <div className="my-1 border-t border-brand-100" />
                  <form action={logoutAction}>
                    <button type="submit" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-red-50">
                      Se déconnecter
                    </button>
                  </form>
                </div>
              </details>
            ) : (
              <div className="ml-1 flex items-center gap-1.5">
                <ButtonLink href="/connexion" variant="ghost" size="sm" className="hidden sm:inline-flex">
                  Connexion
                </ButtonLink>
                <ButtonLink href="/inscription" size="sm">
                  S&apos;inscrire
                </ButtonLink>
              </div>
            )}
          </div>
        </div>

        <div className="hidden items-center gap-1 pb-3 lg:flex">
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 [&::-webkit-details-marker]:hidden">
              <ShoppingBag className="h-4 w-4 text-brand-600" />
              Toutes les catégories
            </summary>
            <div className="absolute left-0 top-11 z-50 grid w-[640px] grid-cols-2 gap-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-soft">
              {categories.map((category) => (
                <div key={category.id}>
                  <Link
                    href={`/catalogue?categorie=${category.slug}`}
                    className="flex items-center gap-2 text-sm font-semibold text-ink hover:text-brand-700"
                  >
                    <span aria-hidden="true">{category.icon ?? "•"}</span>
                    {category.name}
                  </Link>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    {category.children.map((child) => (
                      <Link
                        key={child.id}
                        href={`/catalogue?categorie=${child.slug}`}
                        className="text-xs text-muted hover:text-brand-700"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>

          <Link href="/catalogue" className="rounded-full px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50">
            Acheter
          </Link>
          <Link href="/encheres" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50">
            <Gavel className="h-4 w-4 text-brand-600" /> Enchères
          </Link>
          <Link href="/vendre" className="rounded-full px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50">
            Vendre gratuitement
          </Link>
          <Link
            href="/premium"
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            <Sparkles className="h-4 w-4" /> Premium
            <Badge tone="brand" className="ml-0.5">3 mois offerts</Badge>
          </Link>
          <Link href="/trophees" className="rounded-full px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50">
            Trophées
          </Link>
          <Link href="/solidarite" className="rounded-full px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50">
            Solidarité
          </Link>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> Paiement sécurisé
            </span>
            <span>0,5 % de commission</span>
            <span>Livraison suivie</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function IconLink({
  href,
  label,
  count,
  children,
}: {
  href: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label}${count ? ` (${count} non lus)` : ""}`}
      className="relative rounded-full p-2 text-ink hover:bg-brand-50"
    >
      {children}
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
