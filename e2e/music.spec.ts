import { expect, test } from "@playwright/test";
import { makeWav } from "../src/test/audio-fixtures";
import { signedInUser } from "./helpers";

// Background music (Passo 4): uploaded through the app, checked by content, stored privately in S3
// and played back through short-lived signed links.

test("music uploaded in the wizard is saved with the series and plays back", async ({ page }) => {
  await signedInUser(page);
  await page.goto("/dashboard/create/");
  await page.getByRole("button", { name: /^Storytelling/ }).click();
  await page.locator("#niche").fill("Calm bedtime stories");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Adam/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // A real WAV and a text file pretending to be an MP3.
  await page.getByTestId("music-file-input").setInputFiles([
    { name: "calm-piano.wav", mimeType: "audio/wav", buffer: Buffer.from(makeWav(8000)) },
    { name: "fake.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("not really an mp3 file, just text") },
  ]);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("fake.mp3: This isn't an MP3 or WAV file.");
  const library = page.getByRole("list", { name: "Your music" });
  await expect(library.getByRole("listitem")).toHaveCount(1);
  await expect(library).toContainText("calm-piano.wav");
  await expect(page.getByRole("checkbox", { name: "Use calm-piano.wav" })).toHaveAttribute("aria-checked", "true");

  // Links to our own network are refused by the server.
  await page.locator("#urls").fill("https://localhost/secret.mp3");
  await page.getByRole("button", { name: "Import links" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("isn't allowed");
  await expect(page.locator("#urls")).toHaveValue("https://localhost/secret.mp3"); // kept for correction

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Realism" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Bold Stroke/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Create Series" }).click();

  await expect(page).toHaveURL(/\/dashboard\/series\/[0-9a-f-]{36}\/$/);
  await expect(page.getByText("1 track(s)")).toBeVisible();
  const player = page.getByLabel("Play calm-piano.wav");
  await expect(player).toBeVisible();

  // The player's signed link serves the exact file, supports Range, and can't be tampered with.
  const src = (await player.getAttribute("src"))!;
  expect(src).toMatch(/^\/api\/media\/users\/[0-9a-f-]{36}\/music\/[0-9a-f-]{36}\.wav\?exp=\d+&sig=/);
  const full = await page.request.get(src);
  expect(full.status()).toBe(200);
  expect(full.headers()["content-type"]).toBe("audio/wav");
  expect((await full.body()).equals(Buffer.from(makeWav(8000)))).toBe(true);

  const part = await page.request.get(src, { headers: { Range: "bytes=0-3" } });
  expect(part.status()).toBe(206);
  expect((await part.body()).toString("ascii")).toBe("RIFF");

  const tampered = src.replace(/sig=[^&]+/, "sig=forged");
  expect((await page.request.get(tampered)).status()).toBe(403);
  const otherFile = src.replace(/music\/[0-9a-f-]{36}\.wav/, "music/00000000-0000-0000-0000-000000000000.wav");
  expect((await page.request.get(otherFile)).status()).toBe(403);
});

test("removing a track from the library takes it out of the series", async ({ page }) => {
  await signedInUser(page);
  const upload = await page.request.post("/api/music/", {
    headers: { "Content-Type": "audio/wav", "X-File-Name": "loop.wav" },
    data: Buffer.from(makeWav(2000)),
  });
  expect(upload.status()).toBe(201);
  const track = (await upload.json()) as { id: string; url: string };

  const created = await page.request.post("/api/series/", {
    data: {
      name: "Loop series",
      formats: ["facts"],
      niche: "Space facts",
      language: "en",
      voice: "nova",
      artStyle: "anime",
      captionStyle: "sleek",
      frequency: "weekly",
      postTime: "10:00",
      musicTrackIds: [track.id],
    },
  });
  expect(created.status()).toBe(201);

  await page.goto("/dashboard/create/");
  await page.getByRole("button", { name: /^Storytelling/ }).click();
  await page.locator("#niche").fill("Anything");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Adam/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Remove loop.wav" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("list", { name: "Your music" })).toHaveCount(0);

  const series = (await (await page.request.get("/api/series/")).json()) as { name: string; musicTrackIds: string[] }[];
  expect(series.find((s) => s.name === "Loop series")?.musicTrackIds).toEqual([]);
  expect((await page.request.get(track.url)).status()).toBe(404); // file gone from storage
});

test("deleting the account deletes its files", async ({ page }) => {
  await signedInUser(page);
  const upload = await page.request.post("/api/music/", {
    headers: { "Content-Type": "audio/wav", "X-File-Name": "mine.wav" },
    data: Buffer.from(makeWav(1000)),
  });
  const { url } = (await upload.json()) as { url: string };
  expect((await page.request.get(url)).status()).toBe(200);

  expect((await page.request.delete("/api/account/")).status()).toBe(204);
  expect((await page.request.get(url)).status()).toBe(404); // the signed link is still valid, the file is gone
});

test("uploads are limited to 10 MB and to the signed-in user", async ({ page, request }) => {
  const anonymous = await request.post("/api/music/", { headers: { "Content-Type": "audio/wav" }, data: Buffer.from(makeWav(10)) });
  expect(anonymous.status()).toBe(401);

  await signedInUser(page);
  const big = Buffer.alloc(10 * 1024 * 1024 + 1);
  Buffer.from(makeWav(10)).copy(big);
  const tooBig = await page.request.post("/api/music/", { headers: { "Content-Type": "audio/wav", "X-File-Name": "big.wav" }, data: big });
  expect(tooBig.status()).toBe(413);
});
