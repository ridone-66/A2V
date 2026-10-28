import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";
import { hasPremium } from "@/lib/services/premium";
import { Avatar } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccountNav } from "@/components/account/account-nav";

export const metadata: Metadata = { title: { default: "Mon compte", template: "%s — Mon compte A2V" } };

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/compte");
  const isPremium = await hasPremium(user.id);

  return (
    <div className="container-page py-8 lg:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={user.publicName} src={user.profile?.avatarUrl} size={48} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">Mon compte</p>
            <p className="text-lg font-bold leading-tight">{user.publicName}</p>
            <p className="text-xs text-muted">{user.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={user.role === "ADMIN" ? "brand" : user.role === "MODERATOR" ? "info" : "neutral"}>
            {user.role === "ADMIN" ? "Administrateur" : user.role === "MODERATOR" ? "Modération" : "Membre"}
          </Badge>
          <Link href={`/vendeur/${user.publicName}`} className="text-sm font-medium text-brand-700 hover:underline">
            Voir mon profil public
          </Link>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="mb-4 rounded-2xl border border-brand-100 bg-white p-4 lg:hidden">
            <AccountNav isPremium={isPremium} />
          </div>
          <div className="hidden lg:block">
            <AccountNav isPremium={isPremium} />
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
