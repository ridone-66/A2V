/**
 * Télécharge des photos réelles (Wikimedia Commons) pour les annonces de démo.
 *
 * - redimensionne en 1200 × 900 (4:3) pour un rendu homogène ;
 * - écrit public/demo/<slug>.jpg ;
 * - génère docs/PHOTOS.md avec l'attribution et la licence.
 *
 * Usage : node scripts/fetch-demo-photos.mjs
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const UA = "A2V-demo/1.0 (projet pedagogique; contact@a2v.example)";
const OUT_DIR = path.join("public", "demo");
const MANIFEST = "docs/PHOTOS.md";

const base = JSON.parse(await readFile("scripts/photo-candidates.json", "utf8"));
const extra = JSON.parse(await readFile("scripts/photo-candidates-extra.json", "utf8"));
const extra2 = JSON.parse(await readFile("scripts/photo-candidates-extra2.json", "utf8"));
const c3 = JSON.parse(await readFile("scripts/photo-candidates3.json", "utf8"));
const c4 = JSON.parse(await readFile("scripts/photo-candidates4.json", "utf8"));
const c5 = JSON.parse(await readFile("scripts/photo-candidates5.json", "utf8"));

const SOURCES = { base, extra, extra2, c3, c4, c5 };

const picks = [
  { slug: "robe-vintage-fleurie-annees-70-1", source: "extra2", key: "floral print dress", index: 0, subject: "Robe fleurie" },
  { slug: "sac-en-cuir-camel-graine-2", source: "c4", key: "leather satchel", index: 5, subject: "Sac en cuir camel" },
  { slug: "canon-ae-1-argentique-revise-3", source: "base", key: "canon-ae-1-argentique-revise-3", index: 4, subject: "Canon AE-1" },
  { slug: "casque-sony-wh-1000xm4-4", source: "extra2", key: "Sony WH-1000XM3", index: 1, subject: "Casque Sony" },
  { slug: "fauteuil-scandinave-en-teck-5", source: "base", key: "fauteuil-scandinave-en-teck-5", index: 3, subject: "Fauteuil en teck" },
  { slug: "lampe-opaline-annees-60-6", source: "extra", key: "milk glass table lamp", index: 3, subject: "Lampe opaline" },
  { slug: "velo-de-ville-peugeot-restaure-7", source: "c3", key: "Peugeot bicycle", index: 1, subject: "Vélo Peugeot" },
  { slug: "sneakers-nike-air-max-90-8", source: "base", key: "sneakers-nike-air-max-90-8", index: 4, subject: "Nike Air Max 90" },
  { slug: "chemise-en-lin-homme-9", source: "c3", key: "linen shirt", index: 7, subject: "Chemise en lin" },
  { slug: "set-de-6-verres-a-pied-10", source: "base", key: "set-de-6-verres-a-pied-10", index: 4, subject: "Verres à pied" },
  { slug: "le-petit-prince-edition-1965-11", source: "base", key: "le-petit-prince-edition-1965-11", index: 6, subject: "Le Petit Prince" },
  { slug: "manteau-en-laine-vierge-12", source: "c3", key: "red wool coat", index: 1, position: "top", subject: "Manteau en laine" },
  { slug: "enceinte-bluetooth-marshall-13", source: "c3", key: "Marshall amplifier speaker", index: 6, subject: "Enceinte Marshall" },
  { slug: "table-basse-en-bois-massif-14", source: "c3", key: "coffee table wood", index: 3, subject: "Table basse en bois" },
  { slug: "pull-en-cachemire-col-rond-15", source: "c5", key: "cream sweater", index: 2, subject: "Pull en cachemire" },
  { slug: "jeu-de-construction-en-bois-16", source: "base", key: "jeu-de-construction-en-bois-16", index: 5, subject: "Jeu de construction" },
  { slug: "enchere-montre", source: "base", key: "enchere-montre", index: 0, subject: "Montre vintage" },
  { slug: "enchere-polaroid", source: "base", key: "enchere-polaroid", index: 0, subject: "Polaroid SX-70" },
  { slug: "enchere-veste-jean", source: "base", key: "enchere-veste-jean", index: 4, subject: "Veste en jean" },
  { slug: "enchere-sac-luxe", source: "extra", key: "tan leather shoulder bag", index: 0, subject: "Sac de luxe" },
  { slug: "enchere-tableau", source: "base", key: "enchere-tableau", index: 2, subject: "Tableau abstrait" },
  { slug: "enchere-nikon", source: "base", key: "enchere-nikon", index: 0, subject: "Nikon FM2" },
  { slug: "enchere-eames", source: "c5", key: "molded plastic chair", index: 6, subject: "Chaise design" },
  { slug: "enchere-bougies", source: "base", key: "enchere-bougies", index: 4, subject: "Bougies artisanales" },
  { slug: "enchere-lithographie", source: "c3", key: "lithography print art", index: 5, subject: "Lithographie" },
  { slug: "enchere-shearling", source: "c3", key: "sheepskin jacket", index: 3, subject: "Manteau shearling" },
];

await mkdir(OUT_DIR, { recursive: true });
const manifest = [];

function cleanArtist(value) {
  const cleaned = (value ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned || /not researched/i.test(cleaned) || /^(unknown author\s*)+$/i.test(cleaned)) {
    return "Auteur non précisé";
  }
  return cleaned.replace(/(unknown author\s*)+/gi, "Unknown author");
}

for (const pick of picks) {
  const candidate = SOURCES[pick.source][pick.key]?.[pick.index];
  if (!candidate) throw new Error(`Candidat introuvable : ${pick.slug}`);
  const response = await fetch(candidate.thumb, { headers: { "User-Agent": UA } });
  if (!response.ok) throw new Error(`Téléchargement impossible (${response.status}) : ${candidate.title}`);
  const input = Buffer.from(await response.arrayBuffer());

  const output = path.join(OUT_DIR, `${pick.slug}.jpg`);
  await sharp(input)
    .rotate()
    .resize(1200, 900, { fit: "cover", position: pick.position ?? "attention" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(output);

  manifest.push({
    subject: pick.subject,
    file: `/demo/${pick.slug}.jpg`,
    title: candidate.title.replace(/\s+/g, " ").trim(),
    artist: cleanArtist(candidate.artist),
    license: candidate.license,
    source: candidate.descriptionUrl,
  });
  console.log(`✓ ${pick.slug}.jpg`);
  await new Promise((resolve) => setTimeout(resolve, 200));
}

const rows = manifest
  .map(
    (item) =>
      `| ${item.subject} | \`${item.file}\` | ${item.title.replaceAll("|", "\\|")} | ${item.artist.replaceAll("|", "\\|")} | ${item.license} | [Wikimedia Commons](${item.source}) |`,  )
  .join("\n");

const content = `# Photos des annonces de démonstration

Les photos ci-dessous sont des **photos d'illustration** importées depuis Wikimedia Commons.
Elles ne représentent pas les articles réellement vendus (les annonces de démonstration sont fictives)
et ne constituent ni une promesse d'authenticité, ni une description contractuelle.

Licences : CC0, domaine public, CC BY, CC BY-SA. L'attribution et le lien vers la fiche source
sont indiqués pour chaque image. Les images ont été recadrées en 1200 × 900 pour l'affichage.
La même attribution est publiée sur la page publique \`/credits-photos\`.

| Annonce | Fichier local | Fichier d'origine | Auteur | Licence | Source |
| --- | --- | --- | --- | --- | --- |
${rows}

> Script de génération : \`node scripts/fetch-demo-photos.mjs\`.
> Les photos sont stockées dans \`public/demo/\` et servies localement (aucun appel externe au runtime).
`;

await writeFile(MANIFEST, content, "utf8");

// Liste typée utilisée par la page publique /credits-photos.
const credits = manifest.map((item) => ({
  subject: item.subject,
  file: item.file,
  title: item.title,
  artist: item.artist,
  license: item.license,
  source: item.source,
}));
const creditsFile = `/**
 * ATTENTION : fichier généré par scripts/fetch-demo-photos.mjs.
 * Ne pas modifier à la main : relancer le script pour régénérer les crédits.
 */
export type DemoPhotoCredit = {
  subject: string;
  file: string;
  title: string;
  artist: string;
  license: string;
  source: string;
};

export const DEMO_PHOTO_CREDITS: DemoPhotoCredit[] = ${JSON.stringify(credits, null, 2)};
`;
await writeFile("src/lib/demo-photo-credits.ts", creditsFile, "utf8");

console.log(`\n${manifest.length} photos prêtes. Attribution : ${MANIFEST} et src/lib/demo-photo-credits.ts`);
