import { randomUUID } from "node:crypto";
import { test, type Page } from "@playwright/test";
import { PASSWORD, registerViaApi } from "../e2e/helpers";

async function signIn(page: Page) {
  const email = await registerViaApi(page);
  const csrf = (await (await page.request.get("/api/auth/csrf")).json()) as { csrfToken: string };
  await page.request.post("/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: PASSWORD } });
}

test("probe: 11th track, hidden selections", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await signIn(page);
  const id = randomUUID();

  await page.goto(`/dashboard/series/${id}/edit/?data=huge`);
  await page.getByRole("heading", { name: "Edit series" }).waitFor();
  const boxes = page.getByRole("checkbox", { name: /^Use / });
  console.log("PROBE checked before:", await page.locator('[role=checkbox][aria-checked=true]').count());
  await boxes.nth(10).click();
  console.log("PROBE checked after 11th click:", await page.locator('[role=checkbox][aria-checked=true]').count());
  console.log("PROBE save enabled:", await page.getByRole("button", { name: "Save changes" }).isEnabled());

  await page.goto(`/dashboard/series/${id}/edit/?data=worst`);
  await page.getByRole("heading", { name: "Edit series" }).waitFor();
  const visible = async (name: RegExp) => {
    const el = page.getByRole("button", { name }).first();
    const box = await el.boundingBox();
    const scroller = await el.evaluate((n) => n.closest(".overflow-y-auto")?.getBoundingClientRect().toJSON());
    return { button: box && { y: Math.round(box.y), h: Math.round(box.height) }, list: scroller && { top: Math.round(scroller.top), bottom: Math.round(scroller.bottom) } };
  };
  console.log("PROBE quiz format (selected) vs its list:", JSON.stringify(await visible(/^Quiz/)));
  console.log("PROBE marcus voice (selected) vs its list:", JSON.stringify(await visible(/^Marcus/)));
  console.log("PROBE expired instagram card text:", await page.getByRole("button", { name: /^Instagram/ }).innerText());
  await ctx.close();
});
