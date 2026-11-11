import { expect, test, type Page } from "@playwright/test";
import { makeWav } from "../src/test/audio-fixtures";
import { createSeriesViaApi, signedInUser } from "./helpers";

async function uploadTrack(page: Page, name: string) {
  const res = await page.request.post("/api/music/", { headers: { "Content-Type": "audio/wav", "X-File-Name": name }, data: Buffer.from(makeWav(1500)) });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

test("every field of a series can be edited, including its music", async ({ page }) => {
  await signedInUser(page);
  const oldTrack = await uploadTrack(page, "old-loop.wav");
  const id = await createSeriesViaApi(page, { musicTrackIds: [oldTrack] });

  await page.goto(`/dashboard/series/${id}/`);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/series/${id}/edit/$`));
  const save = page.getByRole("button", { name: "Save changes" });
  await expect(save).toBeDisabled(); // nothing changed yet

  // Formats & niche
  await page.getByRole("button", { name: /^Top 5 Lists/ }).click();
  await page.locator("#niche").fill("Strange lighthouses and their keepers");
  // Voice
  await page.locator("#lang").selectOption("pt");
  await page.getByRole("button", { name: /^Bella/ }).click();
  // Music: upload a new track (selected automatically) and drop the old one
  await page.getByTestId("music-file-input").setInputFiles({ name: "new-theme.wav", mimeType: "audio/wav", buffer: Buffer.from(makeWav(3000)) });
  await expect(page.getByRole("checkbox", { name: "Use new-theme.wav" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("checkbox", { name: "Use old-loop.wav" }).click();
  // Art and captions
  await page.getByRole("button", { name: "Anime" }).click();
  await page.getByRole("button", { name: /Red Highlight/ }).click();
  // Schedule
  await page.locator("#name").fill("Lighthouse Stories");
  await page.getByRole("button", { name: /^YouTube/ }).click();
  await page.locator("#freq").selectOption("weekly");
  await page.locator("#time").fill("07:45");
  await page.locator("#tz").selectOption("Asia/Tokyo");

  await expect(save).toBeEnabled();
  await save.click();

  await expect(page).toHaveURL(new RegExp(`/dashboard/series/${id}/$`));
  await expect(page.getByText("Changes saved")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lighthouse Stories" })).toBeVisible();
  await expect(page.getByText("1 video per week at 07:45 (Asia/Tokyo)")).toBeVisible();
  await expect(page.getByLabel("Play new-theme.wav")).toBeVisible();
  await expect(page.getByLabel("Play old-loop.wav")).toHaveCount(0);

  const saved = (await (await page.request.get(`/api/series/${id}/`)).json()) as Record<string, unknown>;
  expect(saved).toMatchObject({
    name: "Lighthouse Stories",
    niche: "Strange lighthouses and their keepers",
    language: "pt",
    voice: "bella",
    artStyle: "anime",
    captionStyle: "red",
    platforms: ["youtube"],
    frequency: "weekly",
    postTime: "07:45",
    timezone: "Asia/Tokyo",
  });
  expect((saved.formats as string[]).sort()).toEqual(["storytelling", "top5"]);
  expect((saved.musicTrackIds as string[]).length).toBe(1);
  expect(saved.musicTrackIds).not.toContain(oldTrack);
});

test("save stays disabled while a section is incomplete, and Cancel discards the changes", async ({ page }) => {
  await signedInUser(page);
  const id = await createSeriesViaApi(page);
  await page.goto(`/dashboard/series/${id}/edit/`);

  await page.locator("#name").fill("");
  await expect(page.getByText("Give your series a name.")).toBeVisible(); // the exact reason, not a generic hint
  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();

  await page.getByRole("button", { name: /^Storytelling/ }).click(); // the only format: now none
  await page.locator("#name").fill("Back to a name");
  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();

  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/series/${id}/$`));
  await expect(page.getByRole("heading", { name: "E2E Mysteries" })).toBeVisible();
});

test("someone else's series can't be edited", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await signedInUser(pageA);
  const id = await createSeriesViaApi(pageA);
  await ctxA.close();

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await signedInUser(pageB);
  await pageB.goto(`/dashboard/series/${id}/edit/`);
  await expect(pageB.getByText("This series doesn't exist anymore.")).toBeVisible();
  expect((await pageB.request.patch(`/api/series/${id}/`, { data: { name: "Hijacked" } })).status()).toBe(404);
  await ctxB.close();
});
