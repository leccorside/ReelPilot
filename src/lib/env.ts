import { z } from "zod";

// Server-side environment variables, validated once. A missing or malformed variable
// stops the server at start (src/instrumentation.ts) with a readable list of problems.

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
