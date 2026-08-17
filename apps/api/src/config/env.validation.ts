import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),
  /** Browser origin of the SPA, used for CORS. */
  CORS_ORIGIN: z.string().min(1),

  // Clerk — the API verifies session tokens with the secret key (the publishable key is frontend-only).
  CLERK_SECRET_KEY: z.string().min(1),

  // Cloudflare R2 (blob storage) — wired up in the Files feature.
  R2_ACCOUNT_ID: z.string().optional().default(''),
  R2_ACCESS_KEY_ID: z.string().optional().default(''),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(''),
  R2_BUCKET: z.string().optional().default('dataroom'),
  R2_ENDPOINT: z.string().optional().default(''),
  R2_PRESIGN_EXPIRES: z.coerce.number().int().positive().default(900),
});

export type Env = z.infer<typeof envSchema>;

/** Passed to `ConfigModule.forRoot({ validate })` — fails fast on boot if env is invalid. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map(
        (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
      )
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }
  return parsed.data;
}
