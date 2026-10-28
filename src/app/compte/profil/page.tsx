import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ImageIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ActionForm } from "@/components/forms/action-form";
import { ImageUploader } from "@/components/forms/image-uploader";
import { updateProfileAction } from "@/app/actions/account";

export const metadata: Metadata = { title: "Profil public" };

export default async function ProfilePage() {
  const user = await requireUser("/compte/profil");
  const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compte"
        title="Profil public"
        description="Ces informations sont visibles sur vos annonces et votre page vendeur. Votre adresse e-mail et vos adresses de livraison ne sont jamais publiques."
        action={
          <Link href={`/vendeur/${user.publicName}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
            Voir ma page publique <ExternalLink className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="Informations visibles" description="Le nom public doit rester unique sur la plateforme." />
          <CardBody>
            <ActionForm action={updateProfileAction} submitLabel="Enregistrer mon profil" pendingLabel="Enregistrement…">
              <div>
                <label className="label">Photo de profil</label>
                <ImageUploader name="avatarUrl" initial={profile?.avatarUrl ? [profile.avatarUrl] : []} max={1} />
                <p className="mt-1 text-xs text-muted">Une photo carrée fonctionne mieux. Elle est stockée via le service d&apos;images configuré.</p>
              </div>

              <div>
                <label htmlFor="publicName" className="label">Nom public</label>
                <input id="publicName" name="publicName" className="input" defaultValue={user.publicName} minLength={3} maxLength={30} required />
                <p className="mt-1 text-xs text-muted">3 à 30 caractères : lettres, chiffres, points, tirets, underscores.</p>
              </div>

              <div>
                <label htmlFor="bio" className="label">Présentation</label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={5}
                  maxLength={600}
                  className="input"
                  defaultValue={profile?.bio ?? ""}
                  placeholder="Ce que vous vendez, votre style, vos délais d'expédition…"
                />
                <p className="mt-1 text-xs text-muted">600 caractères maximum. N&apos;indiquez pas votre adresse exacte ni votre téléphone.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="city" className="label">Ville (facultatif)</label>
                  <input id="city" name="city" className="input" maxLength={80} defaultValue={profile?.city ?? ""} />
                </div>
                <div>
                  <label htmlFor="region" className="label">Région (facultatif)</label>
                  <input id="region" name="region" className="input" maxLength={80} defaultValue={profile?.region ?? ""} />
                </div>
                <div>
                  <label htmlFor="postalCode" className="label">Code postal (facultatif)</label>
                  <input id="postalCode" name="postalCode" className="input" inputMode="numeric" maxLength={5} defaultValue={profile?.postalCode ?? ""} />
                  <p className="mt-1 text-xs text-muted">Jamais affiché publiquement, même si la localisation est publique.</p>
                </div>
              </div>

              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="publicLocation" defaultChecked={profile?.publicLocation ?? true} className="mt-0.5 h-4 w-4 accent-brand-600" />
                <span>
                  Afficher ma ville sur mes annonces
                  <span className="block text-xs text-muted">Seule la ville est affichée, jamais le code postal ni l&apos;adresse.</span>
                </span>
              </label>
            </ActionForm>
          </CardBody>
        </Card>

        <aside className="space-y-4">
          <Card className="p-5 text-sm">
            <h2 className="flex items-center gap-2 font-semibold"><ImageIcon className="h-4 w-4 text-brand-600" /> Ce qui est public</h2>
            <ul className="mt-3 space-y-1.5 text-xs leading-5 text-muted">
              <li>Nom public et photo</li>
              <li>Présentation et ville si activée</li>
              <li>Annonces publiées et avis reçus</li>
              <li>Membre depuis (mois et année)</li>
            </ul>
            <p className="mt-3 text-xs leading-5 text-muted">
              Ne sont jamais publics : e-mail, adresses, commandes, messages, données de paiement.
            </p>
          </Card>

          <Alert tone="info" title="Choix du nom public">
            Changer de nom public ne casse pas vos liens de commande. Les anciens liens vers <code>/vendeur/…</code> peuvent toutefois
            ne plus fonctionner : l&apos;identifiant public change.
          </Alert>
        </aside>
      </div>
    </div>
  );
}
