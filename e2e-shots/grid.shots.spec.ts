import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, registerViaApi } from "../e2e/helpers";

async function signIn(page: Page) {
  const email = await registerViaApi(page);
  const { csrfToken } = (await (await page.request.get("/api/auth/csrf")).json()) as { csrfToken: string };
  await page.request.post("/api/auth/callback/credentials", { form: { csrfToken, email, password: PASSWORD } });
}

for (const vp of [
  { name: "1280", width: 1280, height: 900, scale: 1 },
  { name: "768", width: 768, height: 1000, scale: 1 },
  { name: "320", width: 320, height: 700, scale: 1 },
  { name: "zoom200", width: 640, height: 450, scale: 2 },
]) {
  test(`grid ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale });
    await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style"); s.textContent = "[data-dev-toggle]{display:none!important}"; document.head.appendChild(s);
    }));
    const page = await ctx.newPage();
    await signIn(page);
    for (const data of ["worst", "empty", "one", "huge"]) {
      await page.goto(`/dashboard/videos/?data=${data}`);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `test-results/shots/grid-${data}-${vp.name}.png`, fullPage: data !== "huge" });
      if (data !== "worst") continue;
      const report = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        return {
          vw,
          scrollWidth: document.documentElement.scrollWidth,
          cards: Array.from(document.querySelectorAll('[data-testid="video-card"]')).map((card) => {
            const c = card.getBoundingClientRect();
            const ps = card.querySelectorAll("p");
            const title = ps[0] as HTMLElement;
            const meta = ps[1] as HTMLElement;
            const err = card.querySelector("p.text-destructive") as HTMLElement | null;
            const word = card.querySelector(".caption-word") as HTMLElement | null;
            const publish = card.querySelector("button") as HTMLElement;
            const badge = card.querySelector(".absolute.left-2") as HTMLElement;
            return {
              title: title.textContent?.slice(0, 22),
              cardW: Math.round(c.width),
              titleCut: title.scrollWidth > title.clientWidth,
              metaCut: meta.scrollWidth > meta.clientWidth,
              errShowsRefund: err ? err.scrollHeight <= err.clientHeight + 1 : null,
              wordOverflow: word ? Math.round(word.getBoundingClientRect().width - c.width) : null,
              publishOverflow: publish.scrollWidth > publish.clientWidth,
              badgeH: Math.round(badge.getBoundingClientRect().height),
              badgeOverflow: Math.round(badge.getBoundingClientRect().right - c.right),
            };
          }),
        };
      });
      console.log(`GRID ${vp.name} vw=${report.vw} scroll=${report.scrollWidth}`);
      for (const c of report.cards) console.log(`  ${JSON.stringify(c)}`);
    }
    await ctx.close();
  });
}
