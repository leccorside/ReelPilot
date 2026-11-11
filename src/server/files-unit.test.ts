import { describe, expect, it } from "vitest";
import { makeMp3Frame, makeMp3Id3, makeWav } from "@/test/audio-fixtures";
import { cleanFileName, sniffAudio } from "./audio-file";
import { signMediaPath, verifyMediaSignature } from "./media-url";
import { isBlockedAddress, safeFetch } from "./safe-fetch";

describe("sniffAudio (by content, never by name)", () => {
  it("recognizes WAV and both kinds of MP3", () => {
    expect(sniffAudio(makeWav())).toEqual({ ext: "wav", mime: "audio/wav" });
    expect(sniffAudio(makeMp3Id3())).toEqual({ ext: "mp3", mime: "audio/mpeg" });
    expect(sniffAudio(makeMp3Frame())).toEqual({ ext: "mp3", mime: "audio/mpeg" });
  });

  it("refuses everything else", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const html = new TextEncoder().encode("<!doctype html><html><body>TikTok sound</body></html>");
    const exe = new TextEncoder().encode("MZ\x90\x00 this is not audio at all");
    const fakeFrame = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0, 0, 0, 0, 0, 0, 0, 0]); // reserved bits
    for (const bytes of [png, html, exe, fakeFrame, new Uint8Array(), new Uint8Array(5)]) expect(sniffAudio(bytes)).toBeNull();
  });
});

describe("cleanFileName", () => {
  it("drops folders and control characters and limits the length", () => {
    expect(cleanFileName("../../etc/passwd", "x")).toBe("passwd");
    expect(cleanFileName("C:\\music\\song\u0007.mp3", "x")).toBe("song.mp3");
    expect(cleanFileName("   ", "Fallback")).toBe("Fallback");
    expect(cleanFileName("a".repeat(300), "x")).toHaveLength(120);
  });
});

describe("signed media links", () => {
  const secret = "s".repeat(40);
  const key = "users/u1/music/t1.mp3";

  it("work for their own key until they expire", () => {
    const now = Date.UTC(2026, 10, 11, 12, 0, 0);
    const url = new URL(signMediaPath(secret, key, 60, now), "http://x");
    expect(url.pathname).toBe("/api/media/users/u1/music/t1.mp3");
    const exp = url.searchParams.get("exp");
    const sig = url.searchParams.get("sig");
    expect(verifyMediaSignature(secret, key, exp, sig, now + 59_000)).toEqual({ ok: true });
    expect(verifyMediaSignature(secret, key, exp, sig, now + 61_000)).toEqual({ ok: false, reason: "expired" });
  });

  it("can't be moved to another file, extended or forged", () => {
    const url = new URL(signMediaPath(secret, key), "http://x");
    const exp = url.searchParams.get("exp")!;
    const sig = url.searchParams.get("sig")!;
    expect(verifyMediaSignature(secret, "users/u2/music/t1.mp3", exp, sig).ok).toBe(false);
    expect(verifyMediaSignature(secret, key, String(Number(exp) + 3600), sig).ok).toBe(false);
    expect(verifyMediaSignature("other-secret".repeat(4), key, exp, sig).ok).toBe(false);
    expect(verifyMediaSignature(secret, key, null, sig).ok).toBe(false);
    expect(verifyMediaSignature(secret, key, exp, "x").ok).toBe(false);
  });
});

describe("SSRF protection", () => {
  it("blocks private, loopback, link-local, metadata and reserved addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.5",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "::",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "not-an-ip",
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"]) expect(isBlockedAddress(ip), ip).toBe(false);
  });

  it("refuses non-https links, IP literals of our network and credentials in the URL", async () => {
    const opts = { maxBytes: 1024, timeoutMs: 3000 };
    await expect(safeFetch("http://example.com/a.mp3", opts)).rejects.toThrow("Only https links");
    await expect(safeFetch("ftp://example.com/a.mp3", opts)).rejects.toThrow("Only https links");
    await expect(safeFetch("https://127.0.0.1/a.mp3", opts)).rejects.toThrow("isn't allowed");
    await expect(safeFetch("https://[::1]/a.mp3", opts)).rejects.toThrow("isn't allowed");
    await expect(safeFetch("https://169.254.169.254/latest/meta-data", opts)).rejects.toThrow("isn't allowed");
    await expect(safeFetch("https://user:pass@example.com/a.mp3", opts)).rejects.toThrow("user name or password");
    await expect(safeFetch("not a url", opts)).rejects.toThrow("valid link");
  });

  it("refuses host names that resolve to our network (checked at connection time)", async () => {
    // "localhost" and the Docker service names resolve to loopback/private addresses.
    await expect(safeFetch("https://localhost/a.mp3", { maxBytes: 1024, timeoutMs: 3000 })).rejects.toThrow("isn't allowed");
    await expect(safeFetch("https://postgres:5432/", { maxBytes: 1024, timeoutMs: 3000 })).rejects.toThrow("isn't allowed");
  });
});
