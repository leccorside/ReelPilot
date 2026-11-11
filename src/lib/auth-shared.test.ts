import { describe, expect, it } from "vitest";
import { authErrorMessage, DEFAULT_AFTER_LOGIN, safeCallbackUrl } from "./auth-shared";

describe("safeCallbackUrl", () => {
  it("keeps same-site paths with their query string", () => {
    expect(safeCallbackUrl("/dashboard/videos/?page=2")).toBe("/dashboard/videos/?page=2");
  });

  it("falls back to the dashboard for anything that could leave the site", () => {
    for (const bad of [null, "", "https://evil.example/", "//evil.example", "/\\evil.example", "javascript:alert(1)", "dashboard"]) {
      expect(safeCallbackUrl(bad)).toBe(DEFAULT_AFTER_LOGIN);
    }
  });

  it("accepts absolute URLs only on our own origin", () => {
    expect(safeCallbackUrl("http://localhost:3100/dashboard/billing/", "http://localhost:3100")).toBe("/dashboard/billing/");
    expect(safeCallbackUrl("http://localhost:3100.evil.example/x", "http://localhost:3100")).toBe(DEFAULT_AFTER_LOGIN);
  });

  it("never sends the user back to the login page", () => {
    expect(safeCallbackUrl("/login/?callbackUrl=/x")).toBe(DEFAULT_AFTER_LOGIN);
  });
});

describe("authErrorMessage", () => {
  it("maps known codes and hides unknown ones behind a generic message", () => {
    expect(authErrorMessage(null)).toBeNull();
    expect(authErrorMessage("invalid_credentials")).toBe("Incorrect email or password.");
    expect(authErrorMessage("rate_limited")).toMatch(/Too many attempts/);
    expect(authErrorMessage("SomethingInternal")).toBe("Something went wrong. Please try again.");
  });
});
