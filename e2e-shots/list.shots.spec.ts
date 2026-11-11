import { test, type Page } from "@playwright/test";
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
  test(`list ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale });
    await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style"); s.textContent = "[data-dev-toggle]{display:none!important}"; document.head.appendChild(s);
    }));
    const page = await ctx.newPage();
    await signIn(page);
    for (const data of ["worst", "empty", "one", "huge"]) {
      const t0 = Date.now();
      await page.goto(`/dashboard/series/?data=${data}`);
      await page.waitForTimeout(800);
      if (data === "huge") {
        const rows = await page.locator("tbody tr").count();
        const t = await page.evaluate(() => { const s = performance.now(); window.scrollTo(0, document.body.scrollHeight); return performance.now() - s; });
        console.log(`HUGE ${vp.name}: rows=${rows} pageHeight=${await page.evaluate(() => document.documentElement.scrollHeight)} load+render=${Date.now() - t0}ms scroll=${Math.round(t)}ms`);
        await page.screenshot({ path: `test-results/shots/list-huge-${vp.name}.png` });
        continue;
      }
      await page.screenshot({ path: `test-results/shots/list-${data}-${vp.name}.png`, fullPage: true });
      if (data !== "worst") continue;
      const r = await page.evaluate(() => {
        const wrap = document.querySelector(".overflow-x-auto") as HTMLElement;
        const table = wrap.querySelector("table")!;
        const actionsTh = Array.from(table.querySelectorAll("th")).pop()!.getBoundingClientRect();
        const rows = Array.from(table.querySelectorAll("tbody tr")).map((tr) => {
          const tds = tr.querySelectorAll("td");
          const name = tds[0].getBoundingClientRect();
          const btn = tr.querySelector("button") as HTMLElement;
          return { name: (tds[0].textContent ?? "").slice(0, 18), nameW: Math.round(name.width), nameH: Math.round(name.height), published: tds[3].textContent, btnOverflow: btn.scrollWidth > btn.clientWidth };
        });
        return {
          vw: document.documentElement.clientWidth,
          pageScroll: document.documentElement.scrollWidth,
          tableW: Math.round(table.getBoundingClientRect().width),
          wrapW: Math.round(wrap.getBoundingClientRect().width),
          actionsVisibleWithoutScroll: actionsTh.right <= wrap.getBoundingClientRect().right + 1,
          rows,
        };
      });
      console.log(`LIST ${vp.name}: vw=${r.vw} page=${r.pageScroll} table=${r.tableW} box=${r.wrapW} actionsVisible=${r.actionsVisibleWithoutScroll}`);
      for (const row of r.rows) console.log(`  ${JSON.stringify(row)}`);
    }
    await ctx.close();
  });
}
