import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, registerViaApi } from "../e2e/helpers";

const OUT = "test-results/shots";
const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900, scale: 1 },
  { name: "768", width: 768, height: 1000, scale: 1 },
  { name: "320", width: 320, height: 700, scale: 1 },
  { name: "zoom200", width: 640, height: 450, scale: 2 }, // 1280×900 window at 200% zoom
];

async function signIn(page: Page) {
  const email = await registerViaApi(page);
  const csrf = (await (await page.request.get("/api/auth/csrf")).json()) as { csrfToken: string };
  await page.request.post("/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: PASSWORD } });
}

for (const vp of VIEWPORTS) {
  test(`editor ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale });
    const page = await ctx.newPage();
    await signIn(page);
    const id = randomUUID();
    for (const data of ["worst", "empty", "one", "huge"]) {
      await page.goto(`/dashboard/series/${id}/edit/?data=${data}`);
      await expect(page.getByRole("heading", { name: "Edit series" })).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${data}-${vp.name}.png`, fullPage: true });
      // The viewport as the user first sees it (header, crumbs, first section) and with the save bar.
      await page.screenshot({ path: `${OUT}/${data}-${vp.name}-top.png` });
      if (data === "worst") {
        // States that only appear after an interaction: an upload in progress / failed, a link that fails.
        await page.locator("#urls").fill("https://cdn.example-music-library-for-creators.com/downloads/2026/11/" + "x".repeat(140) + ".mp3");
        await page.getByRole("button", { name: "Import links" }).click();
        await expect(page.getByRole("main").getByRole("alert")).toBeVisible({ timeout: 30_000 });
        const longName = "Ambient_Background_Music_For_YouTube_Shorts_Free_Download_HQ_320kbps_Remastered_Final_v2_FINAL_definitivo_2026_copy.wav";
        await page.getByTestId("music-file-input").setInputFiles({ name: longName, mimeType: "audio/wav", buffer: Buffer.from("not audio") });
        await page.waitForTimeout(1500);
        await page.locator("#urls").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${OUT}/worst-${vp.name}-errors.png` });
        // Name over the API limit (the input has no maxLength) → what does saving say?
        await page.locator("#name").fill("Histórias Assustadoras da Vovó Aleksandra Wiśniewska-Kowalczyk – Temporada 2 – Especial de Halloween");
        await page.getByRole("button", { name: "Save changes" }).click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${OUT}/worst-${vp.name}-save.png` });
        // Overflow probe: anything wider than the viewport?
        const overflow = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const wide: string[] = [];
          for (const el of Array.from(document.querySelectorAll("main *"))) {
            const r = (el as HTMLElement).getBoundingClientRect();
            if (r.right > vw + 1 && r.width > 0 && getComputedStyle(el).position !== "fixed") {
              const text = (el.textContent ?? "").trim().slice(0, 50);
              wide.push(`${el.tagName.toLowerCase()}.${(el as HTMLElement).className.toString().split(" ").slice(0, 3).join(".")} right=${Math.round(r.right)} "${text}"`);
            }
          }
          return { vw, scrollWidth: document.documentElement.scrollWidth, wide: wide.slice(0, 12) };
        });
        console.log(`OVERFLOW ${vp.name}: ${JSON.stringify(overflow)}`);
      }
    }
    await ctx.close();
  });
}
