import { expect, test } from "@playwright/test";
import { createSeriesViaApi, creditsLeft, signedInUser } from "./helpers";

// The dashboard on top of the real API (Passo 3): series, videos and credits live in the database.

test("the wizard creates a series and queues its first video (1 credit)", async ({ page }) => {
  await signedInUser(page);
  await expect(creditsLeft(page)).toHaveText("60/60");

  await page.goto("/dashboard/create/");
  await page.getByRole("button", { name: /^Storytelling/ }).click();
  await page.locator("#niche").fill("The most mysterious lighthouses in the world");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: /^Adam/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Realism" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Bold Stroke/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.locator("#name").fill("Lighthouses");
  await page.locator("#freq").selectOption("three_per_week");
  await page.getByRole("button", { name: "Create Series" }).click();

  await expect(page).toHaveURL(/\/dashboard\/series\/[0-9a-f-]{36}\/$/);
  await expect(page.getByRole("heading", { name: "Lighthouses" })).toBeVisible();
  await expect(page.getByText("3 videos per week at 18:00")).toBeVisible();
  await expect(page.getByTestId("video-card")).toHaveCount(1);
  await expect(page.getByTestId("video-card").first()).toContainText("In queue");
  await expect(creditsLeft(page)).toHaveText("59/60");
});

test("generating and deleting a queued video moves credits both ways", async ({ page }) => {
  await signedInUser(page);
  const id = await createSeriesViaApi(page);
  await page.goto(`/dashboard/series/${id}/`);

  await page.getByRole("button", { name: "Generate video" }).click();
  await expect(page.getByText("Video added to the queue")).toBeVisible();
  await expect(page.getByTestId("video-card")).toHaveCount(1);
  await expect(creditsLeft(page)).toHaveText("59/60");

  await page.getByRole("button", { name: "Delete video" }).click();
  await expect(page.getByRole("dialog")).toContainText("its credit comes back");
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Video deleted. Its credit is back.")).toBeVisible();
  await expect(page.getByTestId("video-card")).toHaveCount(0);
  await expect(creditsLeft(page)).toHaveText("60/60");
});

test("pausing a series is saved on the server; deleting it refunds its queued videos", async ({ page }) => {
  await signedInUser(page);
  const id = await createSeriesViaApi(page);
  await page.request.post(`/api/series/${id}/videos/`);
  await page.request.post(`/api/series/${id}/videos/`);

  await page.goto("/dashboard/series/");
  await expect(creditsLeft(page)).toHaveText("58/60");
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();

  await page.getByRole("button", { name: "Delete E2E Mysteries" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Series deleted")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No series yet" })).toBeVisible();
  await expect(creditsLeft(page)).toHaveText("60/60");
});

test("another account never sees someone else's series (same browser)", async ({ browser }) => {
  // Two sign-ups and several navigations in two contexts: in full runs right after a code change
  // (dev server recompiling) it went past 60 s at a different line each time, with the right
  // content arriving just after the timeout. Not a product failure, so more time instead of retries.
  test.slow();
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await signedInUser(pageA);
  const id = await createSeriesViaApi(pageA, { name: "Private Series" });
  await ctxA.close();

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await signedInUser(pageB);
  await expect(pageB.getByRole("heading", { name: "No series yet" })).toBeVisible();

  await pageB.goto(`/dashboard/series/${id}/`);
  await expect(pageB.getByText("This series doesn't exist anymore.")).toBeVisible();
  expect((await pageB.request.get(`/api/series/${id}/`)).status()).toBe(404);
  expect((await pageB.request.delete(`/api/series/${id}/`)).status()).toBe(404);
  expect((await pageB.request.post(`/api/series/${id}/videos/`)).status()).toBe(404);
  await ctxB.close();
});

test("preferences are saved on the server", async ({ page }) => {
  await signedInUser(page);
  await page.goto("/dashboard/settings/");
  await page.getByLabel("Time zone").selectOption("Europe/Prague");
  await expect(page.getByText("Time zone saved")).toBeVisible();
  const autoPublish = page.getByRole("switch", { name: "Publish automatically" });
  await expect(autoPublish).toHaveAttribute("aria-checked", "true");
  // Wait for the save itself: reloading right after the click could cancel the PATCH in flight.
  const saved = page.waitForResponse((r) => r.url().includes("/api/account/") && r.request().method() === "PATCH");
  await autoPublish.click();
  expect((await saved).ok()).toBe(true);

  await page.reload();
  await expect(page.getByLabel("Time zone")).toHaveValue("Europe/Prague");
  await expect(page.getByRole("switch", { name: "Publish automatically" })).toHaveAttribute("aria-checked", "false");
});

test("billing shows the real plan and balance and charges nothing", async ({ page }) => {
  await signedInUser(page);
  await page.goto("/dashboard/billing/");
  await expect(page.getByTestId("billing-credits")).toHaveText("60/60");
  await page.getByRole("button", { name: "Upgrade" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("nothing is charged");
});
