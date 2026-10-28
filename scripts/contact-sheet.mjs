/**
 * Planche de contrôle : affiche les images candidates dans une grille numérotée.
 * Usage : node scripts/contact-sheet.mjs <json> <sortie.png>
 * Le JSON doit être un objet { libellé: [url, ...] }.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const input = process.argv[2];
const output = process.argv[3] ?? "scripts/contact-sheet.png";
if (!input) throw new Error("Indiquez le fichier JSON des candidats.");
const data = JSON.parse(await readFile(input, "utf8"));

const rows = [];
for (const [label, urls] of Object.entries(data)) {
  for (const [index, url] of urls.entries()) {
    rows.push(`<figure><img src="${url}" loading="eager" /><figcaption>${label} · ${index}</figcaption></figure>`);
  }
}

const html = `<!doctype html><meta charset="utf-8">
<style>
  body { margin: 0; padding: 16px; background: #f5f3f7; font-family: Arial, sans-serif; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  figure { margin: 0; background: #fff; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
  img { width: 100%; height: 210px; object-fit: cover; display: block; background: #eee; }
  figcaption { padding: 6px 8px; font-size: 12px; color: #211A2C; overflow-wrap: anywhere; }
</style>
<div class="grid">${rows.join("")}</div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
await page.setContent(html, { waitUntil: "networkidle", timeout: 120000 });
await page.screenshot({ path: path.resolve(output), fullPage: true });
await browser.close();
console.log(`Planche écrite : ${output} (${rows.length} images)`);
