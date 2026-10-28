import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Download, FileText, ShieldCheck, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { deleteAccountAction } from "@/app/actions/account";

export const metadata: Metadata = { title: "Mes données (RGPD)" };

export default async function PrivacyAccountPage() {
  const user = await requireUser("/compte/confidentialite");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compte"
        title="Mes données personnelles"
        description="Exportez vos données ou demandez la suppression de votre compte. Ces actions sont exécutées côté serveur."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Exporter mes données" description="Fichier JSON lisible contenant les données liées à votre compte." />
          <CardBody className="space-y-3 text-sm">
            <p className="text-muted">
              L&apos;export inclut le profil, les adresses, les annonces, les commandes, les offres, les favoris, les messages, les
              notifications, les dons et les trophées. Les secrets (mot de passe haché, jetons de session) et les références de
              carte bancaire (jamais stockées) sont exclus.
            </p>
            <a
              href="/api/account/export"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
              download
            >
              <Download className="h-4 w-4" /> Télécharger mon export (JSON)
            </a>
            <p className="text-xs text-muted">
              L&apos;export est généré à la demande. Il peut ne pas inclure les données détenues par nos prestataires (paiement,
              messagerie e-mail), qui doivent être demandées séparément en production.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Comprendre mes droits" />
          <CardBody className="space-y-2 text-xs leading-5 text-muted">
            <p className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              Accès, rectification, effacement, limitation, opposition et portabilité. Certaines données comptables doivent être
              conservées après suppression, conformément aux obligations légales.
            </p>
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              Responsable de traitement, sous-traitants et durées de conservation sont détaillés dans la{" "}
              <Link href="/confidentialite" className="link">politique de confidentialité</Link>.
            </p>
            <p>
              Une réclamation peut être adressée à la CNIL. Pour toute demande :{" "}
              <Link href="/contact" className="link">contact</Link>.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card className="border-red-200">
        <CardHeader
          title="Supprimer mon compte"
          description="Action irréversible. Les données nécessaires à la comptabilité et à la preuve peuvent être conservées de façon restreinte."
        />
        <CardBody className="space-y-4">
          <Alert tone="danger" title="Avant de supprimer">
            <ul className="list-disc space-y-1 pl-4 text-sm">
              <li>Vérifiez qu&apos;aucune commande ou enchère n&apos;est en cours.</li>
              <li>Un litige ouvert, une vente non finalisée ou une enchère remportée non payée peuvent bloquer la suppression.</li>
              <li>Cette démonstration anonymise le compte ; aucune récupération n&apos;est possible ensuite.</li>
            </ul>
          </Alert>

          <ActionForm action={deleteAccountAction} submitLabel="Supprimer définitivement mon compte" pendingLabel="Suppression…">
            <div>
              <label htmlFor="password" className="label">Mot de passe actuel</label>
              <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
            </div>
            <div>
              <label htmlFor="confirmation" className="label">
                Saisissez <span className="font-mono font-bold">SUPPRIMER</span> pour confirmer
              </label>
              <input id="confirmation" name="confirmation" className="input font-mono" autoComplete="off" required />
            </div>
            <p className="flex items-start gap-2 text-xs text-muted">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              Le compte connecté ({user.email}) sera déconnecté. Les annonces publiées seront retirées et les données non
              nécessaires anonymisées.
            </p>
          </ActionForm>

          <p className="flex items-center gap-2 text-xs text-muted">
            <Trash2 className="h-4 w-4 text-red-600" />
            Vous pouvez aussi demander la suppression par écrit depuis la page contact si vous ne pouvez plus vous connecter.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
