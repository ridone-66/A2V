import type { ReactNode } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/card";

const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgu", label: "CGU & CGV" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/cookies", label: "Cookies" },
  { href: "/credits-photos", label: "Crédits photos" },
];

export function LegalPage({
  title,
  description,
  updatedAt = "28 octobre 2026",
  children,
}: {
  title: string;
  description: string;
  updatedAt?: string;
  children: ReactNode;
}) {
  return (
    <div className="container-page max-w-5xl py-8 lg:py-10">
      <Breadcrumbs items={[{ label: "Informations légales", href: "/mentions-legales" }, { label: title }]} />
      <PageHeader eyebrow="Informations légales" title={title} description={description} />

      <Alert tone="warning" className="mb-6">
        Modèle de démonstration : ces textes doivent être relus et adaptés par un conseil juridique avant toute exploitation
        commerciale. Les mentions d&apos;éditeur ci-dessous sont fictives ou à compléter.
      </Alert>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Documents légaux" className="hidden lg:block">
          <ul className="sticky top-28 space-y-1 text-sm">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`block rounded-lg px-3 py-2 ${
                    link.label === title ? "bg-brand-100 font-semibold text-brand-800" : "text-muted hover:bg-brand-50 hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <article className="prose-a2v max-w-none space-y-6 text-[15px] leading-7 text-ink">
          {children}
          <p className="border-t border-brand-100 pt-4 text-xs text-muted">Dernière mise à jour : {updatedAt}.</p>
        </article>
      </div>
    </div>
  );
}

export function LegalSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="space-y-2">
      <h2 className="text-lg font-bold text-ink sm:text-xl">{title}</h2>
      {children}
    </section>
  );
}
