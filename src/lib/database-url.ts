/**
 * Résout l'URL PostgreSQL quel que soit le nom fourni par l'intégration Vercel.
 *
 * Prisma attend strictement `DATABASE_URL`. Les intégrations Vercel Postgres /
 * Neon exposent parfois `POSTGRES_PRISMA_URL`, `POSTGRES_URL` ou
 * `POSTGRES_URL_NON_POOLING`. On alimente `DATABASE_URL` avant de créer le
 * client Prisma, sans écraser une valeur déjà définie.
 *
 * Ce module ne doit pas importer `env.ts` (évite un cycle d'import).
 */
export function resolveDatabaseUrl(): string | undefined {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
  ];
  const url = candidates.find((value) => typeof value === "string" && value.trim().length > 0)?.trim();
  if (url && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = url;
  }
  return url;
}
