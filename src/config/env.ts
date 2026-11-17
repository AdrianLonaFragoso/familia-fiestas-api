import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  ADMIN_API_KEY: z.string().min(8, "ADMIN_API_KEY debe tener al menos 8 caracteres"),
  CORS_ORIGINS: z.string().default("http://localhost:8080"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "entorno"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Configuración de entorno inválida: ${details}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}

export function corsOrigins(): string[] {
  const configured = getEnv()
    .CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...new Set(["https://familia-fiestas-2026.vercel.app", ...configured])];
}
