import { z } from 'zod';

/** Bootstrap-only env vars required before the app can connect to Postgres/Redis. */
export const BootstrapEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  WEB_ORIGIN: z.string().optional(),
});

export type BootstrapEnv = z.infer<typeof BootstrapEnvSchema>;

export function validateBootstrapEnv(raw: Record<string, unknown>): BootstrapEnv {
  const result = BootstrapEnvSchema.safeParse(raw);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${missing}`);
  }
  return result.data;
}

/** @deprecated Use validateBootstrapEnv - app settings live in the database. */
export const EnvSchema = BootstrapEnvSchema;
export type Env = BootstrapEnv;
export function validateEnv(raw: Record<string, unknown>): BootstrapEnv {
  return validateBootstrapEnv(raw);
}
