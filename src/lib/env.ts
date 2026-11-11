import { z } from "zod";

// Server-side environment variables, validated once. A missing or malformed variable
// stops the server at start (src/instrumentation.ts) with a readable list of problems.

/** Empty strings (e.g. "${VAR:-}" in docker-compose) count as "not set". */
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => /^postgres(ql)?:\/\//.test(v), "deve começar com postgres://"),
  REDIS_URL: z
    .string()
    .url()
    .refine((v) => /^rediss?:\/\//.test(v), "deve começar com redis://"),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(8, "deve ter pelo menos 8 caracteres"),
  S3_BUCKET: z.string().min(3).regex(/^[a-z0-9.-]+$/, "use só letras minúsculas, números, ponto e hífen"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  MAIL_FROM: z.string().min(3),
  AUTH_SECRET: z.string().min(32, "deve ter pelo menos 32 caracteres (openssl rand -base64 32)"),
  /** Google sign-in is enabled only when both are set. */
  AUTH_GOOGLE_ID: optionalString,
  AUTH_GOOGLE_SECRET: optionalString,
  /** Multiplies the sign-in/sign-up rate limits. 1 in production; higher in development so tests can repeat. */
  AUTH_RATE_LIMIT_SCALE: z.coerce.number().positive().default(1),
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "deve ter 32 bytes em base64 (openssl rand -base64 32)"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `- ${i.path.join(".") || "(raiz)"}: ${i.message}`);
    throw new Error(`Variáveis de ambiente inválidas:\n${lines.join("\n")}`);
  }
  return result.data;
}

let cached: Env | null = null;

/** Validated environment (parsed on first use). */
export function env(): Env {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}
