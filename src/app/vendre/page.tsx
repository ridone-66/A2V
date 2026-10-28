import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getCategoriesWithCounts } from "@/lib/services/listings";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { ListingForm } from "@/components/listings/listing-form";
import { createListingAction } from "@/app/actions/listings";

export const metadata: Metadata = {
  title: "Vendre gratuitement",
  description:
    "Publiez une annonce A2V gratuitement, à prix fixe ou aux enchères. Commission de 0,5 % uniquement sur une vente finalisée, jamais sur la mise en ligne.",
};

export default async function SellPage() {
  await requireUser("/vendre");
  const categories = await getCategoriesWithCounts();

  return (
    <div className="container-page py-8 lg:py-10">
      <Breadcrumbs items={[{ label: "Vendre" }]} />
      <PageHeader
        eyebrow="Vendre"
        title="Publiez gratuitement. Payez seulement quand vous vendez."
        description="Une commission de 0,5 % sur le prix final de l'article, hors livraison, est retenue après finalisation de la vente. Aucun abonnement, aucun frais de mise en ligne."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="flex items-start gap-3 p-4">
          <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-semibold">Publication gratuite</p>
            <p className="text-xs text-muted">Aucun frais, même si l&apos;article ne se vend pas.</p>
          </div>
        </Card>
        <Card className="flex items-start gap-3 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-semibold">Paiement protégé</p>
            <p className="text-xs text-muted">Le versement vient après la période de protection.</p>
          </div>
        </Card>
        <Card className="flex items-start gap-3 p-4">
          <span className="mt-0.5 text-lg">🏆</span>
          <div>
            <p className="text-sm font-semibold">Exemple à 100 €</p>
            <p className="text-xs text-muted">Commission {formatMoney(50)} · vous recevez {formatMoney(9950)}.</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <ListingForm
          action={createListingAction}
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
            children: category.children.map((child) => ({ id: child.id, name: child.name })),
          }))}
          submitLabel="Publier mon annonce"
        />

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <Card className="p-5 text-sm">
            <h2 className="font-semibold">Conseils pour bien vendre</h2>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-muted">
              <li>• Photographiez les défauts visibles : la confiance réduit les litiges.</li>
              <li>• Indiquez les dimensions et la matière, pas seulement la marque.</li>
              <li>• Un prix réaliste et des frais de livraison clairs accélèrent la vente.</li>
              <li>• Répondez aux messages : les acheteurs privilégient les vendeurs réactifs.</li>
            </ul>
          </Card>
          <Card className="p-5 text-xs leading-5 text-muted">
            <p className="font-semibold text-ink">Ce que nous ne faisons pas</p>
            <p className="mt-2">
              A2V n&apos;achète pas votre article, ne garantit pas sa conformité et ne prélève pas de commission si la vente est
              annulée avant finalisation. Les objets interdits et les contrefaçons sont retirés.
            </p>
            <Link href="/faq" className="link mt-2 inline-block">Lire la FAQ vendeur</Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
