import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Load .env from repo root when present (dev). In prod, env is injected.
loadEnv();

/**
 * Validated, typed configuration. Parsing at boot means the process fails fast
 * with a clear message if something is misconfigured, rather than throwing deep
 * in a request handler. Secrets live only here and never leave the server.
 */
const EnvSchema = z.object({
  // Most PaaS hosts (Render, Railway, Fly, Cloud Run, Heroku) inject `PORT` and
  // route to whatever the app listens on there. Prefer it, then our own
  // API_PORT, then a dev default — so the same image runs everywhere unchanged.
  PORT: z.coerce.number().int().positive().optional(),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  SESSION_SECRET: z.string().min(16).default('atlas-dev-secret-change-me-1234'),

  OPENROUTER_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  CEREBRAS_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
  GROQ_MODEL: z.string().optional(),
  CEREBRAS_MODEL: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const config = {
  ...parsed.data,
  /** Effective listen port: platform-provided PORT wins, else API_PORT. */
  port: parsed.data.PORT ?? parsed.data.API_PORT,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
};

export type AppConfig = typeof config;
