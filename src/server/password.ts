import { hash, verify } from "@node-rs/argon2";

// argon2id with the library defaults (m=19456 KiB, t=2, p=1), as recommended by OWASP.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    return false; // malformed hash
  }
}

// A real hash of a random value: verifying against it costs the same as a real check, so an
// unknown e-mail takes as long as a wrong password and response times don't reveal which
// addresses have an account.
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(plain: string): Promise<void> {
  dummyHash ??= hash(crypto.randomUUID());
  await verifyPassword(await dummyHash, plain);
}
