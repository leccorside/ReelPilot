import { expect, test } from "@playwright/test";
import { signedInUser } from "./helpers";

// Passo 7: the wizard previews the real narrator (Kokoro), generated once and cached in storage.
// Needs the "ai" profile (container "kokoro"); without it the route answers 503 and the test is skipped.

test("the wizard's voice preview plays the real narrator, in the chosen language", async ({ page }) => {
  await signedInUser(page);
  const probe = await page.request.get("/api/voices/preview/?voice=adam&language=en");
  test.skip(probe.status() === 503, "voice service not running (start it with the \"ai\" profile)");
  expect(probe.status()).toBe(200);

  await page.goto("/dashboard/create/");
  await page.getByRole("button", { name: /^Storytelling/ }).click();
  await page.locator("#niche").fill("Calm bedtime stories");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.locator("#lang").selectOption("hi");
  const answer = page.waitForResponse((r) => r.url().includes("/api/voices/preview/") && r.url().includes("language=hi"));
  await page.getByRole("button", { name: "Preview Bella" }).click();
  const { url } = (await (await answer).json()) as { url: string };
  expect(url).toMatch(/^\/api\/media\/previews\/voices\/v1\/hi-bella\.wav\?exp=\d+&sig=/);
  await expect(page.getByRole("button", { name: "Stop Bella" })).toBeVisible(); // playing

  // The file is a real WAV with speech in it (more than a second of 24 kHz audio).
  const wav = await page.request.get(url);
  expect(wav.headers()["content-type"]).toBe("audio/wav");
  const body = await wav.body();
  expect(body.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(body.length).toBeGreaterThan(44 + 24_000 * 2);

  // Clicking again stops it.
  await page.getByRole("button", { name: "Stop Bella" }).click();
  await expect(page.getByRole("button", { name: "Preview Bella" })).toBeVisible();
});

test("French says that every narrator shares one voice", async ({ page }) => {
  await signedInUser(page);
  await page.goto("/dashboard/create/");
  await page.getByRole("button", { name: /^Storytelling/ }).click();
  await page.locator("#niche").fill("Histoires du soir");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#lang").selectOption("fr");
  await expect(page.getByText("In French, every narrator uses the same voice, each at its own pace.")).toBeVisible();
  await expect(page.locator("#lang option")).toHaveText([/English/, /Spanish/, /Portuguese/, /French/, /Italian/, /Hindi/]); // no German
});
