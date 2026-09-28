import "server-only";
import path from "node:path";
import { z } from "zod";

// Configuración por entorno, validada al arrancar. Valores por defecto razonables: `pnpm dev` funciona sin .env.

const isValidTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const envSchema = z.object({
  /** D01: organización activa. Si no se indica, la dueña del export (`organization.id`). */
  KONTAKTU_ORG_ID: z.string().trim().min(1).optional(),
  DEFAULT_PHONE_REGION: z.string().trim().length(2).default("ES"),
  DISPLAY_TIMEZONE: z.string().trim().refine(isValidTimeZone, "Zona horaria IANA no válida").default("Europe/Madrid"),
  LOCALE: z.string().trim().min(2).default("es-ES"),
  CURRENCY: z.string().trim().length(3).default("EUR"),
  API_LATENCY_MS: z.coerce.number().int().min(0).max(10_000).default(400),
  ALLOW_FAULT_INJECTION: z.enum(["true", "false"]).optional(),
  DATA_DIR: z.string().trim().min(1).optional(),
});

export type AppConfig = ReturnType<typeof parseConfig>;

export function parseConfig(source: Record<string, string | undefined>, nodeEnv = source.NODE_ENV) {
  const env = envSchema.parse(source);
  return {
    organizationIdOverride: env.KONTAKTU_ORG_ID ?? null,
    domain: {
      timeZone: env.DISPLAY_TIMEZONE,
      locale: env.LOCALE,
      currency: env.CURRENCY,
      phoneRegion: env.DEFAULT_PHONE_REGION.toUpperCase(),
    },
    apiLatencyMs: env.API_LATENCY_MS,
    allowFaultInjection: env.ALLOW_FAULT_INJECTION ? env.ALLOW_FAULT_INJECTION === "true" : nodeEnv !== "production",
    dataDir: env.DATA_DIR ?? path.join(process.cwd(), "data"),
  } as const;
}

export const config: AppConfig = parseConfig(process.env);
