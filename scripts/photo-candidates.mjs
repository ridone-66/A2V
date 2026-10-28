/**
 * Recherche des photos réelles sur Wikimedia Commons pour les annonces de démo.
 * Sortie : scripts/photo-candidates.json (à examiner avant téléchargement).
 * Usage : node scripts/photo-candidates.mjs
 */
import { writeFile } from "node:fs/promises";

const UA = "A2V-demo/1.0 (projet pedagogique; contact@a2v.example)";

const items = [
  { slug: "robe-vintage-fleurie-annees-70-1", query: "floral dress" },
  { slug: "sac-en-cuir-camel-graine-2", query: "beige leather handbag" },
  { slug: "canon-ae-1-argentique-revise-3", query: "Canon AE-1" },
  { slug: "casque-sony-wh-1000xm4-4", query: "Sony headphones" },
  { slug: "fauteuil-scandinave-en-teck-5", query: "teak armchair" },
  { slug: "lampe-opaline-annees-60-6", query: "opaline lamp" },
  { slug: "velo-de-ville-peugeot-restaure-7", query: "Peugeot bicycle" },
  { slug: "sneakers-nike-air-max-90-8", query: "Nike Air Max 90" },
  { slug: "chemise-en-lin-homme-9", query: "linen shirt" },
  { slug: "set-de-6-verres-a-pied-10", query: "crystal wine glass" },
  { slug: "le-petit-prince-edition-1965-11", query: "Le Petit Prince book" },
  { slug: "manteau-en-laine-vierge-12", query: "wool coat" },
  { slug: "enceinte-bluetooth-marshall-13", query: "Marshall speaker" },
  { slug: "table-basse-en-bois-massif-14", query: "wooden coffee table" },
  { slug: "pull-en-cachemire-col-rond-15", query: "knitted sweater" },
  { slug: "jeu-de-construction-en-bois-16", query: "wooden toy blocks" },
  { slug: "enchere-montre", query: "vintage wristwatch" },
  { slug: "enchere-polaroid", query: "Polaroid SX-70" },
  { slug: "enchere-veste-jean", query: "denim jacket" },
  { slug: "enchere-sac-luxe", query: "leather handbag" },
  { slug: "enchere-tableau", query: "abstract painting" },
  { slug: "enchere-nikon", query: "Nikon FM2" },
  { slug: "enchere-eames", query: "Eames plastic chair" },
  { slug: "enchere-bougies", query: "scented candle" },
  { slug: "enchere-lithographie", query: "lithograph" },
  { slug: "enchere-shearling", query: "shearling jacket" },
];

async function search(query) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: "6",
    gsrlimit: "10",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1200",
    format: "json",
    origin: "*",
  }).toString();
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (!response.ok) throw new Error(`HTTP ${response.status} pour ${query}`);
  const json = await response.json();
  const pages = json.query?.pages ?? {};
  return Object.values(pages)
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info) return null;
      return {
        title: page.title.replace(/^File:/, ""),
        width: info.width,
        height: info.height,
        thumb: info.thumburl,
        license: info.extmetadata?.LicenseShortName?.value ?? "?",
        artist: (info.extmetadata?.Artist?.value ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 120),
        descriptionUrl: info.descriptionurl,
      };
    })
    .filter(Boolean)
    .filter((candidate) => candidate.width >= 700);
}

const results = {};
for (const item of items) {
  try {
    results[item.slug] = await search(item.query);
    console.log(`${item.slug}: ${results[item.slug].length} candidat(s)`);
  } catch (error) {
    results[item.slug] = [];
    console.error(`${item.slug}: ${error.message}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}

await writeFile("scripts/photo-candidates.json", JSON.stringify(results, null, 2), "utf8");
console.log("Écrit scripts/photo-candidates.json");
