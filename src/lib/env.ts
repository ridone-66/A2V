import { z } from "zod";

/**
 * Validation centralisée des variables d'environnement.
 * Aucune valeur secrète n'est jamais exposée au client : ce module est
 * uniquement importé depuis des modules serveur (`server-only` implicite via
 * l'usage de process.env dans les composants serveur / actions).
 */
const booleanString = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z
    .string()
    .url()
    .default(
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000",
    ),
  APP_NAME: z.string().default("A2V"),
  DEFAULT_CURRENCY: z.string().default("EUR"),
  DEFAULT_LOCALE: z.string().default("fr-FR"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL est requis")
    .default("postgresql://postgres:a2v_local_dev@127.0.0.1:5433/a2v"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET doit contenir au moins 32 caractères").default(
    "dev-only-session-secret-change-me-please-0000",
  ),
  CRON_SECRET: z.string().min(16).default("dev-only-cron-secret"),
  IP_HASH_SALT: z.string().min(8).default("dev-only-ip-salt"),
  PAYMENTS_SIMULATION: booleanString,
  EMAIL_FROM: z.string().default("A2V <no-reply@a2v.example>"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: booleanString,
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PREMIUM: z.string().optional(),
  LAPOSTE_API_KEY: z.string().optional(),
  LAPOSTE_WEBHOOK_SECRET: z.string().optional(),
  LAPOSTE_API_BASE: z.string().url().default("https://api.laposte.fr"),
  SHIPPING_MODE: z.enum(["simulation", "live"]).default("simulation"),
  STORAGE_DRIVER: z.enum(["local", "s3", "vercel-blob"]).default("local"),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  COMMISSION_RATE_BPS: z.coerce.number().int().min(0).max(10000).default(50),
  PREMIUM_PRICE_CENTS: z.coerce.number().int().positive().default(600),
  PREMIUM_TRIAL_MONTHS: z.coerce.number().int().min(0).max(12).default(3),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Configuration d'environnement invalide :\n${details.join("\n")}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "Configuration d'environnement invalide : DATABASE_URL est requis en production (base PostgreSQL hébergée).",
      );
    }
    if (env.SESSION_SECRET.startsWith("dev-only-")) {
      console.warn("[A2V][sécurité] SESSION_SECRET de développement utilisé en production.");
    }
    if (env.STORAGE_DRIVER === "local") {
      console.warn(
        "[A2V][sécurité] STORAGE_DRIVER=local : les téléversements ne seront pas persistants sur Vercel. Utilisez vercel-blob.",
      );
    }
    if (env.PAYMENTS_SIMULATION) {
      console.warn(
        "[A2V][sécurité] Paiements simulés actifs. Ne jamais encaisser de commande réelle dans ce mode.",
      );
    }
  }
  return env;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

/** Les paiements simulés sont explicites et ne doivent jamais être activés en production réelle. */
export const paymentsSimulationEnabled = env.PAYMENTS_SIMULATION;
export const stripeEnabled = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
export const emailConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER);
export const shippingSimulation = env.SHIPPING_MODE === "simulation";

export const configStatus = {
  payments: stripeEnabled ? "stripe" : paymentsSimulationEnabled ? "simulation" : "disabled",
  email: emailConfigured ? "smtp" : "console",
  shipping: shippingSimulation ? "simulation" : env.LAPOSTE_API_KEY ? "live" : "unconfigured",
  storage: env.STORAGE_DRIVER,
} as const;
