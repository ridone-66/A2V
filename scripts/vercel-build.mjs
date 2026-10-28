/**
 * Build de production pour Vercel.
 *
 * 1. génère le client Prisma ;
 * 2. applique les migrations sur la base hébergée ;
 * 3. lance le build Next.js.
 *
 * Vercel exécute automatiquement `vercel-build` lorsqu'il existe.
 *
 * Noms d'URL acceptés (intégrations Vercel Postgres / Neon) :
 * - migration : DIRECT_URL, POSTGRES_URL_NON_POOLING, DATABASE_URL_UNPOOLED,
 *   puis DATABASE_URL ;
 * - exécution : DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL.
 */
import { spawnSync } from "node:child_process";

const directUrl =
  process.env.DIRECT_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL;

const runtimeUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  directUrl;

if (!directUrl || !runtimeUrl) {
  console.error(
    [
      "",
      "[A2V][vercel] Aucune base PostgreSQL n'est configurée pour ce build.",
      "",
      "Ajoutez un store Postgres dans Vercel : Storage → Create Database → Postgres,",
      "puis connectez-le au projet. Vercel expose alors POSTGRES_URL_NON_POOLING",
      "et POSTGRES_PRISMA_URL. Vous pouvez aussi définir explicitement :",
      "  DATABASE_URL = URL poolée",
      "  DIRECT_URL   = URL directe (migrations)",
      "",
      "Après avoir ajouté les variables, relancez le déploiement (Redeploy).",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

function run(label, args, extraEnv = {}) {
  console.log(`\n[A2V][vercel] ${label}`);
  const result = spawnSync("npx", ["--no-install", ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...extraEnv },
  });
  if (result.error) {
    console.error(`[A2V][vercel] ${label} : ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("prisma generate", ["prisma", "generate"]);
run("prisma migrate deploy", ["prisma", "migrate", "deploy"], { DATABASE_URL: directUrl });
run("next build", ["next", "build"], { DATABASE_URL: runtimeUrl });
