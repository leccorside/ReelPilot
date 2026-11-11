import { describe, expect, it, vi } from "vitest";
import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";
import { hardenAdapter } from "./auth-adapter";

function fakeBase() {
  return {
    createUser: vi.fn(async (u: AdapterUser) => u),
    getUserByEmail: vi.fn(async () => null),
    linkAccount: vi.fn(async (a: AdapterAccount) => a),
  } satisfies Partial<Adapter>;
}

describe("hardenAdapter", () => {
  it("lowercases e-mails when creating and looking up users", async () => {
    const base = fakeBase();
    const adapter = hardenAdapter(base as unknown as Adapter);
    await adapter.createUser!({ id: "1", email: "Ana@Gmail.COM", emailVerified: null });
    await adapter.getUserByEmail!("Ana@Gmail.COM");
    expect(base.createUser.mock.calls[0][0].email).toBe("ana@gmail.com");
    expect(base.getUserByEmail.mock.calls[0]).toEqual(["ana@gmail.com"]);
  });

  it("never passes provider tokens on to the database", async () => {
    const base = fakeBase();
    const adapter = hardenAdapter(base as unknown as Adapter);
    await adapter.linkAccount!({
      userId: "1",
      type: "oidc",
      provider: "google",
      providerAccountId: "1234",
      access_token: "ya29.secret",
      refresh_token: "1//refresh",
      id_token: "eyJ.id.token",
      expires_at: 123,
      token_type: "bearer",
      scope: "openid email profile",
      session_state: "s",
    });
    const stored = base.linkAccount.mock.calls[0][0];
    expect(stored).toMatchObject({ userId: "1", provider: "google", providerAccountId: "1234", scope: "openid email profile" });
    expect(JSON.stringify(stored)).not.toMatch(/ya29|refresh|eyJ/);
  });
});
