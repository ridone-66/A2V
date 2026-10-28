import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Paiement confirmé" };

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const order = typeof params.commande === "string" ? params.commande : null;
  const simulated = params.simulation === "1";

  return (
    <div className="container-page max-w-2xl py-14">
      <Card className="p-8 text-center sm:p-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
          <CheckCircle2 className="h-9 w-9" />
        </span>
        <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Merci, votre paiement est enregistré</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">
          {simulated
            ? "Ce paiement a été effectué en mode simulation : aucun montant réel n'a été prélevé. Cette page ne doit pas être utilisée comme preuve de paiement en production."
            : "Votre paiement a été confirmé par le prestataire. Le vendeur va préparer votre colis ; vous recevrez une notification à chaque étape."}
        </p>
        {order ? (
          <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm">
            Numéro de commande : <strong>{order}</strong>
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {order ? <ButtonLink href={`/commande/${order}`}>Suivre ma commande</ButtonLink> : null}
          <ButtonLink href={user ? "/compte/achats" : "/catalogue"} variant="outline">
            {user ? "Mes achats" : "Retour au catalogue"}
          </ButtonLink>
        </div>
        <p className="mt-5 text-xs text-muted">
          Un problème ? Ouvrez un litige depuis la commande ou <Link href="/contact" className="link">contactez-nous</Link>.
        </p>
      </Card>
    </div>
  );
}
