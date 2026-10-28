import { chromium, devices } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Captures de contrôle responsive.
 * Prérequis : serveur démarré (npm run dev ou npm start), base seedée,
 * navigateurs Playwright installés (npx playwright install chromium).
 * Usage : node scripts/screenshots.mjs [baseUrl]
 */
const baseURL = process.argv[2] ?? process.env.E2E_BASE_URL ?? "http://localhost:3000";
const outDir = path.resolve("docs", "captures");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const desktopOptions = { viewport: { width: 1440, height: 900 }, locale: "fr-FR", timezoneId: "Europe/Paris" };
const mobileOptions = { ...devices["Pixel 7"], locale: "fr-FR", timezoneId: "Europe/Paris" };

async function login(email, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(`${baseURL}/connexion`, { waitUntil: "networkidle" });
  if (!page.url().includes("/connexion")) {
    // Session déjà présente (ne devrait pas arriver avec un contexte neuf).
    return { context, page };
  }
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(process.env.DEMO_PASSWORD ?? "A2v!Demo2026");
  await page.locator("#email").locator("xpath=ancestor::form").locator('button[type="submit"]').click();
  await page.waitForURL(/\/(compte|admin)/, { timeout: 20_000 });
  return { context, page };
}

async function capture(name, options, pathName) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const response = await page.goto(`${baseURL}${pathName}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  console.log(`${name.padEnd(28)} ${pathName.padEnd(40)} HTTP ${response?.status() ?? "?"}`);
  await context.close();
}

/** Ouvre une session une seule fois et renvoie son storageState réutilisable. */
async function loginState(email, options) {
  const { context, page } = await login(email, options);
  const state = await context.storageState();
  await context.close();
  return state;
}

async function captureSession(name, storageState, pathName, options) {
  const context = await browser.newContext({ ...options, storageState });
  const page = await context.newPage();
  await page.goto(`${baseURL}${pathName}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  console.log(`${name.padEnd(28)} ${pathName.padEnd(40)} HTTP connecté`);
  await context.close();
}

// Public, sans session.
await capture("01-accueil-desktop", desktopOptions, "/");
await capture("02-catalogue-desktop", desktopOptions, "/catalogue");
await capture("03-encheres-desktop", desktopOptions, "/encheres");
await capture("04-annonce-desktop", desktopOptions, "/annonce/sac-en-cuir-camel-graine-2");
await capture("05-premium-desktop", desktopOptions, "/premium");
await capture("06-solidarite-desktop", desktopOptions, "/solidarite");

// Espace membre (Clara : abonnement actif, trophées, commandes).
const claraState = await loginState("clara@a2v.fr", desktopOptions);
await captureSession("07-compte-desktop", claraState, "/compte", desktopOptions);
await captureSession("08-compte-mobile", claraState, "/compte", mobileOptions);

// Administration.
const adminState = await loginState("admin@a2v.fr", desktopOptions);
await captureSession("09-admin-desktop", adminState, "/admin", desktopOptions);

// Mobile public.
await capture("10-accueil-mobile", mobileOptions, "/");
await capture("11-catalogue-mobile", mobileOptions, "/catalogue");

// Offres réservées Prestige (Clara : abonnement actif).
await captureSession("12-offres-prestige-desktop", claraState, "/premium/offres", desktopOptions);
await captureSession("13-offres-prestige-mobile", claraState, "/premium/offres", mobileOptions);

// Trophées : décor animé latéral.
await capture("14-trophees-desktop", desktopOptions, "/trophees");
await capture("15-trophees-mobile", mobileOptions, "/trophees");

// Informations légales et crédits photos.
await capture("16-mentions-legales-desktop", desktopOptions, "/mentions-legales");
await capture("17-mentions-legales-mobile", mobileOptions, "/mentions-legales");
await capture("18-credits-photos-desktop", desktopOptions, "/credits-photos");

await browser.close();
console.log(`Captures écrites dans ${outDir}`);
