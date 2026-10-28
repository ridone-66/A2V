import Link from "next/link";
import { Heart, Instagram, Linkedin, Mail, ShieldCheck, Truck, Undo2 } from "lucide-react";

const columns = [
  {
    title: "Acheter",
    links: [
      ["Toutes les annonces", "/catalogue"],
      ["Enchères en cours", "/encheres"],
      ["Nouveautés", "/catalogue?tri=recent"],
      ["A2V Prestige", "/premium"],
    ],
  },
  {
    title: "Vendre",
    links: [
      ["Vendre gratuitement", "/vendre"],
      ["Mes ventes", "/compte/ventes"],
      ["Commission 0,5 %", "/faq#commission"],
      ["Conseils de vente", "/faq#vendre"],
    ],
  },
  {
    title: "Aide",
    links: [
      ["FAQ & centre d'aide", "/faq"],
      ["Nous contacter", "/contact"],
      ["Livraison & suivi", "/faq#acheter-et-vendre"],
      ["Litiges & remboursements", "/faq#paiement-et-securite"],
    ],
  },
  {
    title: "A2V",
    links: [
      ["Notre mission solidaire", "/solidarite"],
      ["Programme de trophées", "/trophees"],
      ["Mentions légales", "/mentions-legales"],
      ["CGU / CGV", "/cgu"],
      ["Crédits photos", "/credits-photos"],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-brand-100 bg-brand-50/70 pb-24 pt-12 lg:pb-12">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
          <div>
            <Link href="/" className="text-3xl font-extrabold tracking-tight text-brand-700">
              A2V
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-muted">
              La marketplace communautaire pour acheter, revendre et enchérir en toute confiance. Publication gratuite,
              commission de 0,5 % sur les ventes finalisées.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-2.5 py-1">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> Paiement sécurisé
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-2.5 py-1">
                <Truck className="h-3.5 w-3.5 text-brand-600" /> Livraison suivie
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-2.5 py-1">
                <Undo2 className="h-3.5 w-3.5 text-brand-600" /> Litiges accompagnés
              </span>
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-bold text-ink">{column.title}</h3>
              <ul className="mt-3 space-y-2">
                {column.links.map(([label, href]) => (
                  <li key={href + label}>
                    <Link href={href} className="text-sm text-muted hover:text-brand-700">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 rounded-2xl border border-brand-200 bg-white p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-brand-100 p-2.5 text-brand-700">
              <Heart className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Solidarité contre le cancer du sein</p>
              <p className="mt-1 text-sm text-muted">
                A2V consacre une section dédiée à la recherche et aux soins. Les dons sont suivis séparément des ventes,
                commissions et abonnements.
              </p>
            </div>
          </div>
          <Link
            href="/dons"
            className="inline-flex h-11 items-center justify-center rounded-full bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Faire un don
          </Link>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-brand-200 pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} A2V. Projet de démonstration — documents juridiques à faire valider avant lancement.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/confidentialite" className="hover:text-brand-700">
              Confidentialité & cookies
            </Link>
            <Link href="/mentions-legales" className="hover:text-brand-700">
              Mentions légales
            </Link>
            <Link href="/credits-photos" className="hover:text-brand-700">
              Crédits photos
            </Link>
            <a href="mailto:support@a2v.example" className="inline-flex items-center gap-1 hover:text-brand-700">
              <Mail className="h-3.5 w-3.5" /> support@a2v.example
            </a>
            <span className="inline-flex items-center gap-1.5" title="Comptes de démonstration">
              <Instagram className="h-4 w-4" aria-hidden="true" />
              <Linkedin className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Réseaux sociaux de démonstration</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
