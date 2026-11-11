import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

const key = Buffer.alloc(32, 1).toString("base64");
const otherKey = Buffer.alloc(32, 2).toString("base64");

describe("encryptSecret / decryptSecret", () => {
  it("round-trips and never repeats the ciphertext", () => {
    const a = encryptSecret("ya29.token-ção", key);
    const b = encryptSecret("ya29.token-ção", key);
    expect(a).not.toBe(b);
    expect(a.startsWith("v1:")).toBe(true);
    expect(a).not.toContain("ya29");
    expect(decryptSecret(a, key)).toBe("ya29.token-ção");
  });

  it("rejects a tampered ciphertext or the wrong key", () => {
    const token = encryptSecret("secret", key);
    const [v, iv, tag, data] = token.split(":");
    const flipped = Buffer.from(data, "base64url");
    flipped[0] ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64url")].join(":"), key)).toThrow();
    expect(() => decryptSecret(token, otherKey)).toThrow();
    expect(() => decryptSecret("lixo", key)).toThrow(/formato inválido/);
  });

  it("refuses keys that are not 32 bytes", () => {
    expect(() => encryptSecret("x", Buffer.alloc(16).toString("base64"))).toThrow(/32 bytes/);
  });
});
