import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle, ShieldAlert } from "lucide-react";
import { emailConfigured } from "@/lib/env";
import { getSetting } from "@/lib/services/settings";
import { getCurrentUser } from "@/lib/auth/session";
import { Alert, Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { contactAction } from "@/app/actions/contact";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const [support, user] = await Promise.all([getSetting("platform.supportEmail"), getCurrentUser()]);

  return (
    <div className="container-page max-w-4xl py-8 lg:py-10">
      <Breadcrumbs items={[{ label: "Aide", href: "/faq" }, { label: "Contact" }]} />
      <PageHeader
        eyebrow="Contact"
        title="Écrire à l'équipe A2V"
        description="Pour une question sur une commande, une enchère, un litige ou vos données personnelles."
      />

      {!emailConfigured ? (
        <Alert tone="warning" title="Envoi d'e-mail non configuré" className="mb-5">
          Cet environnement n&apos;a pas de SMTP configuré. Votre message est enregistré dans les journaux serveur, mais personne ne
          le recevra par e-mail. En production, renseignez les variables SMTP documentées dans <code>.env.example</code>.
        </Alert>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageCircle className="h-5 w-5 text-brand-600" /> Votre message
          </h2>
          <ActionForm action={contactAction} submitLabel="Envoyer le message" pendingLabel="Envoi…" className="mt-4" resetOnSuccess>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="label">Nom</label>
                <input id="name" name="name" className="input" defaultValue={user?.publicName ?? ""} maxLength={80} required />
              </div>
              <div>
                <label htmlFor="email" className="label">E-mail</label>
                <input id="email" name="email" type="email" className="input" defaultValue={user?.email ?? ""} required />
              </div>
            </div>
            <div>
              <label htmlFor="subject" className="label">Objet</label>
              <select id="subject" name="subject" className="input" defaultValue="Question générale">
                <option>Question générale</option>
                <option>Commande ou livraison</option>
                <option>Enchère remportée</option>
                <option>Paiement ou remboursement</option>
                <option>Litige</option>
                <option>Abonnement Prestige</option>
                <option>Données personnelles / RGPD</option>
                <option>Signaler un contenu</option>
              </select>
            </div>
            <div>
              <label htmlFor="message" className="label">Message</label>
              <textarea id="message" name="message" rows={7} className="input" minLength={20} maxLength={3000} required placeholder="Décrivez votre demande avec le numéro de commande si applicable." />
            </div>
            <p className="text-xs text-muted">
              Ne transmettez jamais de numéro de carte complet ni de mot de passe. Pour un litige, utilisez la page de la commande
              concernée afin que l&apos;historique soit conservé.
            </p>
          </ActionForm>
        </Card>

        <aside className="space-y-4">
          <Card className="p-5 text-sm">
            <h2 className="flex items-center gap-2 font-semibold">
              <Mail className="h-4 w-4 text-brand-600" /> Adresse de support
            </h2>
            <p className="mt-2 break-all font-mono text-xs text-muted">{support}</p>
            <p className="mt-2 text-xs leading-5 text-muted">
              Cette adresse est un paramètre de démonstration. Elle doit être remplacée par une boîte réellement surveillée avant
              toute mise en production.
            </p>
          </Card>

          <Card className="p-5 text-sm">
            <h2 className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4 text-danger" /> Urgence sécurité
            </h2>
            <p className="mt-2 text-xs leading-5 text-muted">
              Compte compromis ou tentative de fraude ? Changez votre mot de passe, révoquez vos sessions depuis votre compte et
              ouvrez un litige si un paiement est concerné.
            </p>
            <Link href="/compte/securite" className="link mt-2 inline-block text-xs">Gérer ma sécurité</Link>
          </Card>

          <Card className="p-5 text-xs leading-5 text-muted">
            <p className="font-semibold text-ink">Délais</p>
            <p className="mt-2">
              Aucun délai de réponse n&apos;est promis dans cette démonstration. Les litiges liés à une commande passent par la page
              de commande, pas par ce formulaire.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
