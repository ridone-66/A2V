import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Configuration Vitest.
 *
 * Les modules métier portent `import "server-only"` afin d'empêcher leur
 * embarquement dans un bundle client. Ce paquet n'existe pas hors du runtime
 * Next : il est donc remplacé par un stub neutre pour les tests unitaires.
 * Les fonctions testées ici sont pures ; aucun accès base de données n'est
 * effectué (Prisma n'est instancié qu'au chargement du module, sans connexion).
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^server-only$/, replacement: path.resolve(__dirname, "tests/stubs/server-only.ts") },
      { find: /^@\//, replacement: `${path.resolve(__dirname, "src")}/` },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    reporters: "default",
    clearMocks: true,
  },
});
