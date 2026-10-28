/**
 * Seed de démonstration exécuté pendant le build Vercel, uniquement si la base
 * est vide et si SEED_DEMO_DATA=true.
 *
 * Pourquoi ici ? Le réseau local de développement peut bloquer le port 5432
 * des bases hébergées ; l'environnement de build Vercel, lui, peut atteindre
 * PostgreSQL. Le seed est exécuté avec NODE_ENV=development pour contourner
 * volontairement son garde-fou de production.
 */
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";

if (process.env.SEED_DEMO_DATA !== "true") {
  console.log("[A2V][vercel] SEED_DEMO_DATA != true : seed ignoré.");
  process.exit(0);
}

const databaseUrl = process.env.SEED_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[A2V][vercel] Seed impossible : DATABASE_URL manquant.");
  process.exit(1);
}
process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
try {
  const users = await prisma.user.count();
  if (users > 0) {
    console.log(`[A2V][vercel] Base déjà peuplée (${users} utilisateur(s)) : seed ignoré.`);
    process.exit(0);
  }
} finally {
  await prisma.$disconnect();
}

console.log("[A2V][vercel] Base vide : exécution du seed de démonstration…");
const result = spawnSync("npx", ["--no-install", "tsx", "prisma/seed.ts"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    NODE_ENV: "development",
    DATABASE_URL: databaseUrl,
  },
});
if (result.error) {
  console.error(`[A2V][vercel] Seed : ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
