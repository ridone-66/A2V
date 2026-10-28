/**
 * Build de production pour Vercel.
 *
 * 1. génère le client Prisma ;
 * 2. applique les migrations sur la base hébergée (DIRECT_URL si fournie,
 *    sinon DATABASE_URL) ;
 * 3. lance le build Next.js.
 *
 * Vercel exécute automatiquement `vercel-build` lorsqu'il existe.
 */
import { spawnSync } from "node:child_process";

const databaseUrl =
  process.env.DIRECT_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "[A2V][vercel] DATABASE_URL (ou DIRECT_URL / POSTGRES_URL_NON_POOLING) est requis pour appliquer les migrations.",
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
run("prisma migrate deploy", ["prisma", "migrate", "deploy"], { DATABASE_URL: databaseUrl });
run("next build", ["next", "build"]);
