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
  // --- video worker (Passo 5) ---
  /** Videos one worker container makes at the same time. */
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  /** Scratch space for a video being made (a Docker volume); each video gets its own folder. */
  WORKER_TMP_DIR: z.string().min(1).default("/tmp/reelpilot"),
  /** Scripts: "claude" (Claude API, needs ANTHROPIC_API_KEY) or "fake" (fixed script, no cost). */
  SCRIPT_PROVIDER: z.enum(["fake", "claude"]).default("fake"),
  ANTHROPIC_API_KEY: optionalString,
  /** Writes the scripts (the plan's choice; claude-opus-5-5 is more capable and costs twice as much). */
  CLAUDE_SCRIPT_MODEL: z.string().min(1).default("claude-sonnet-5-5"),
  /** Reviews each script against the platforms' content rules (cheap classification). */
  CLAUDE_REVIEW_MODEL: z.string().min(1).default("claude-haiku-5-5"),
  CLAUDE_SCRIPT_EFFORT: z.enum(["low", "medium", "high"]).default("medium"),
  /** Pause in each fake step, so progress can be watched in the dashboard (0 in tests). */
  FAKE_PROVIDER_DELAY_MS: z.coerce.number().int().min(0).max(60_000).default(0),
}).refine((e) => e.SCRIPT_PROVIDER !== "claude" || e.ANTHROPIC_API_KEY, {
  message: "SCRIPT_PROVIDER=claude precisa de ANTHROPIC_API_KEY",
  path: ["ANTHROPIC_API_KEY"],
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
