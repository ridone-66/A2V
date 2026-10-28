import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { permissionsForRole } from "@/lib/auth/permissions";
import { Avatar } from "@/components/ui/card";
import { Alert } from "@/components/ui/card";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s — Administration A2V" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const permissions = permissionsForRole(user.role);

  return (
    <div className="container-page py-8 lg:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700 text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Administration</p>
            <p className="text-sm font-bold text-ink">A2V — espace protégé</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Avatar name={user.publicName} src={user.profile?.avatarUrl} size={32} />
          <div className="text-right">
            <p className="font-semibold">{user.publicName}</p>
            <p className="text-xs text-muted">{user.role === "ADMIN" ? "Administrateur" : "Modération"}</p>
          </div>
          <Link href="/compte" className="rounded-full border border-brand-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-brand-50">
            Quitter
          </Link>
        </div>
      </div>

      <Alert tone="warning" className="mb-6">
        Toutes les actions sensibles sont vérifiées côté serveur par permission et journalisées dans l&apos;audit. Les montants
        affichés peuvent inclure des paiements simulés : aucun virement réel n&apos;est déclenché depuis cette interface.
      </Alert>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <details className="rounded-2xl border border-brand-100 bg-white p-4 lg:hidden">
            <summary className="cursor-pointer list-none text-sm font-semibold text-brand-700">Menu administration</summary>
            <div className="mt-3"><AdminNav permissions={permissions} /></div>
          </details>
          <div className="hidden lg:block">
            <AdminNav permissions={permissions} />
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
