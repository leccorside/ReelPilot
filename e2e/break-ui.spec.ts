import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createSeriesViaApi, signedInUser } from "./helpers";

// Regression tests from the break-ui run on the series editor (CONTEXTO.md #19). They use the
// development-only worst-case datasets (src/lib/dev-data.ts, ?data=…), so they run against the dev server.

async function openEditor(page: Page, data: "worst" | "empty" | "one" | "huge") {
  await page.goto(`/dashboard/series/${randomUUID()}/edit/?data=${data}`);
  await expect(page.getByRole("heading", { name: "Edit series" })).toBeVisible();
}

test.describe("series editor with worst-case data", () => {
  test("phone width: no sideways scrolling, and the breadcrumb keeps 'Edit' (#1, #11)", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 700 } });
    const page = await ctx.newPage();
    await signedInUser(page);
    await openEditor(page, "worst");

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    const edit = page.getByRole("navigation").getByText("Edit", { exact: true });
    await expect(edit).toBeInViewport({ ratio: 1 });
    await ctx.close();
  });

  test("the chosen format and voice are never hidden in a scroll box (#2, #3)", async ({ page }) => {
    await signedInUser(page);
    await openEditor(page, "empty"); // only format: Quiz (the last one)
    const quiz = page.getByRole("button", { name: /^Quiz/ });
    expect(await quiz.evaluate((el) => el.closest(".overflow-y-auto") === null)).toBe(true);

    await openEditor(page, "worst"); // voice: Marcus (the last one)
    const marcus = page.getByRole("button", { name: /^Marcus/ });
    expect(await marcus.evaluate((el) => el.closest(".overflow-y-auto") === null)).toBe(true);
  });

  test("track names stay readable, long ones keep their extension (#4, #10)", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 700 } });
    const page = await ctx.newPage();
    await signedInUser(page);
    await openEditor(page, "worst");
    const first = page.getByRole("list", { name: "Your music" }).getByRole("listitem").first();
    await expect(first).toContainText(".mp3");
    // On a phone the name gets the row's width (actions move under it), not "Lo-…".
    const nameBox = first.locator("[title]").first();
    expect((await nameBox.boundingBox())!.width).toBeGreaterThan(160);
    await ctx.close();
  });

  test("at most 10 tracks can be picked, and a long library starts collapsed (#5, #12)", async ({ page }) => {
    await signedInUser(page);
    await openEditor(page, "huge"); // 10 of 50 selected
    await expect(page.getByTestId("music-selected-count")).toHaveText("10/10 selected");
    const rows = page.getByRole("list", { name: "Your music" }).getByRole("listitem");
    expect(await rows.count()).toBeLessThanOrEqual(10);
    await page.getByRole("button", { name: "Show all 50 tracks" }).click();
    await expect(rows).toHaveCount(50);
    await expect(page.getByRole("checkbox", { name: /Background loop 11/ })).toBeDisabled();
    await page.getByRole("checkbox", { name: /Background loop 01/ }).click(); // unselect one…
    await expect(page.getByRole("checkbox", { name: /Background loop 11/ })).toBeEnabled(); // …and another can be picked
  });

  test("an expired connection says so instead of 'Not connected' (#7)", async ({ page }) => {
    await signedInUser(page);
    await openEditor(page, "worst");
    await expect(page.getByRole("button", { name: /^Instagram/ }).getByText("Reconnect needed")).toBeVisible();
  });
});

test("name and description can't go over the API limits, and the API explains its limit (#6)", async ({ page }) => {
  await signedInUser(page);
  const id = await createSeriesViaApi(page);
  await page.goto(`/dashboard/series/${id}/edit/`);
  await page.locator("#name").fill("Histórias Assustadoras da Vovó Aleksandra Wiśniewska-Kowalczyk – Temporada 2 – Especial de Halloween");
  expect((await page.locator("#name").inputValue()).length).toBe(80);
  await page.locator("#niche").fill("x".repeat(1200));
  expect((await page.locator("#niche").inputValue()).length).toBe(1000);
  await expect(page.locator("#niche-count")).toHaveText("1,000/1,000");

  const res = await page.request.patch(`/api/series/${id}/`, { data: { name: "n".repeat(81) } });
  expect(res.status()).toBe(400);
  expect(await res.json()).toEqual({ error: "The series name can have at most 80 characters." });
});
