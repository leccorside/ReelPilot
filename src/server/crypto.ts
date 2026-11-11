import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for secrets stored in the database (social network tokens).
// Format: "v1:<iv base64url>:<auth tag base64url>:<ciphertext base64url>".
// The key is ENCRYPTION_KEY (32 bytes, base64). The "v1" prefix allows key rotation later.

const VERSION = "v1";

function parseKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY deve ter 32 bytes em base64");
  return key;
}

export function encryptSecret(plain: string, keyBase64: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", parseKey(keyBase64), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(":");
}

export function decryptSecret(token: string, keyBase64: string): string {
  const [version, iv, tag, data] = token.split(":");
  if (version !== VERSION || !iv || !tag || data === undefined) throw new Error("segredo cifrado em formato inválido");
  const decipher = createDecipheriv("aes-256-gcm", parseKey(keyBase64), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
