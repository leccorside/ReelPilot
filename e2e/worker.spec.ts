import { expect, test } from "@playwright/test";
import { createSeriesViaApi, creditsLeft, signedInUser } from "./helpers";

// Passo 5: "Generate video" goes through the worker (BullMQ) and ends as a real MP4, made with
// the fake providers (fixed script, silent narration, solid-color images) and real ffmpeg.

test("a generated video shows its steps and ends as a real MP4 with a thumbnail and a download", async ({ page }) => {
  test.slow(); // the worker takes ~2 s per step in development, and other tests queue videos too
  await signedInUser(page);
  const id = await createSeriesViaApi(page);
  await page.goto(`/dashboard/series/${id}/`);
  await page.getByRole("button", { name: "Generate video" }).click();

  const card = page.getByTestId("video-card").first();
  await expect(card.getByRole("progressbar")).toBeVisible();
  await expect(card).toContainText("Ready", { timeout: 120_000 });
  await expect(card.getByRole("progressbar")).toHaveCount(0);
  await expect(card.locator("img")).toHaveAttribute("src", /^\/api\/media\/users\/[0-9a-f-]+\/videos\/[0-9a-f-]{36}\/thumbnail\.jpg\?exp=\d+&sig=/);

  const download = card.getByRole("link", { name: "Download" });
  await expect(download).toHaveAttribute("download", /^E2E Mysteries #1\.mp4$/);
  const res = await page.request.get((await download.getAttribute("href"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("video/mp4");
  const body = await res.body();
  expect(body.subarray(4, 8).toString("ascii")).toBe("ftyp"); // an MP4 container
  expect(body.length).toBeGreaterThan(20_000);

  // Made once, charged once.
  await expect(creditsLeft(page)).toHaveText("59/60");
});
