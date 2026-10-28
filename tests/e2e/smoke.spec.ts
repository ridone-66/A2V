import { expect, test } from "@playwright/test";

const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "A2v!Demo2026";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/connexion");
  await page.getByLabel(/e-?mail/i).first().fill(email);
  await page.getByLabel(/mot de passe/i).first().fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /me connecter|connexion|se connecter/i }).click();
  await expect(page).toHaveURL(/\/(compte|admin)/, { timeout: 15_000 });
}

test.describe("parcours public", () => {
  test("accueil, catalogue et fiche annonce", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.goto("/catalogue");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    const firstListing = page.locator('a[href^="/annonce/"]').first();
    if (await firstListing.count()) {
      await firstListing.click();
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });

  test("pages de confiance accessibles", async ({ page }) => {
    for (const path of ["/faq", "/contact", "/mentions-legales", "/cgu", "/confidentialite", "/cookies"]) {
      const response = await page.goto(path);
      expect(response?.status(), `statut HTTP de ${path}`).toBeLessThan(400);
    }
  });

  test("le catalogue est utilisable sur mobile", async ({ page }) => {
    await page.goto("/catalogue");
    await expect(page.locator("h1").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("les annonces de démonstration utilisent des photos réelles et le signalent", async ({ page }) => {
    await page.goto("/annonce/robe-vintage-fleurie-annees-70-1");
    const photo = page.locator('img[src^="/demo/"]').first();
    await expect(photo).toBeVisible();
    await expect(photo).toHaveAttribute("src", /\.jpg$/);
    await expect(page.getByText(/Photo d'illustration — annonce de démonstration/i)).toBeVisible();
  });

  test("la page Trophées est décorée sans déborder horizontalement", async ({ page }) => {
    await page.goto("/trophees");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/trophées/i);
    await expect(page.locator("[data-trophy-decoration]")).toHaveCount(2);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("les mentions légales et les crédits photos sont publiés", async ({ page }) => {
    for (const path of ["/mentions-legales", "/credits-photos", "/confidentialite", "/cookies", "/cgu"]) {
      const response = await page.goto(path);
      expect(response?.status(), `statut HTTP de ${path}`).toBeLessThan(400);
    }

    await page.goto("/mentions-legales");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/mentions légales/i);
    await expect(page.getByText(/Dénomination sociale/i)).toBeVisible();
    await expect(page.getByText(/Hébergement du site/i)).toBeVisible();
    await expect(page.getByText(/Médiateur désigné/i)).toBeVisible();

    await page.goto("/credits-photos");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/crédits photos/i);
    await expect(page.locator('a[href*="commons.wikimedia.org"]').first()).toBeVisible();
  });
});

test.describe("compte et administration", () => {
  test("un membre accède à son tableau de bord et à ses notifications", async ({ page }) => {
    await login(page, "clara@a2v.fr");
    await page.goto("/compte");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.goto("/compte/notifications");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("une annonce à plus de 10 000 € est automatiquement Prestige", async ({ page }) => {
    await login(page, "clara@a2v.fr");
    await page.goto("/compte/annonces/nouvelle");
    const price = page.locator("#priceEuros");
    const premium = page.locator('input[name="isPremiumOnly"]');
    await price.fill("1000.01");
    await expect(premium).not.toBeChecked();
    await expect(premium).toBeEnabled();
    await price.fill("10000");
    await expect(premium).not.toBeChecked();
    await price.fill("10000.01");
    await expect(premium).toBeChecked();
    await expect(premium).toBeDisabled();
  });

  test("une enchère à plus de 10 000 € est réservée aux membres", async ({ page }) => {
    await page.goto("/encheres/enchere-sac-luxe");
    await expect(page.getByRole("heading", { name: /réservée aux membres/i })).toBeVisible();

    await login(page, "clara@a2v.fr");
    await page.goto("/encheres/enchere-sac-luxe");
    await expect(page.getByRole("heading", { name: /Sac de luxe/i })).toBeVisible();
    await expect(page.getByText(/Vous êtes le vendeur/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /réservée aux membres/i })).toHaveCount(0);
  });

  test("les offres Prestige sont réservées aux membres", async ({ page }) => {
    await page.goto("/premium/offres");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/réservées/i);
    await expect(page.locator('a[href^="/annonce/"]')).toHaveCount(0);

    await login(page, "lea@a2v.fr");
    await page.goto("/premium/offres");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/réservées/i);
    await expect(page.locator('a[href^="/annonce/"]')).toHaveCount(0);
  });

  test("un membre Prestige voit les offres réservées", async ({ page }) => {
    await login(page, "clara@a2v.fr");
    await page.goto("/compte");
    await expect(page.locator('a[href="/premium/offres"]:visible').first()).toBeVisible();
    await page.goto("/premium/offres");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Vos offres réservées/i);
    await expect(page.locator('a[href^="/annonce/"]').first()).toBeVisible();
  });

  test("un membre ne peut pas ouvrir l'administration", async ({ page }) => {
    await login(page, "thomas@a2v.fr");
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin$/);
  });

  test("un administrateur ouvre le journal d'audit", async ({ page }) => {
    await login(page, "admin@a2v.fr");
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/audit/i);
    await page.goto("/admin/parametres");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.goto("/admin/categories");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/catégories/i);
    await page.goto("/admin/statistiques");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/statistiques/i);
  });
});
