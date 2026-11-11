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

// Regression tests from the break-ui run on the creation wizard (CONTEXTO.md #20).
test.describe("creation wizard", () => {
  const continueBtn = (page: Page) => page.getByRole("button", { name: "Continue" });

  /** From the voice step to the schedule step with simple choices. */
  async function finishSteps(page: Page) {
    await page.getByRole("button", { name: /^Adam/ }).click();
    await continueBtn(page).click(); // → music
    await continueBtn(page).click(); // → art
    await page.getByRole("button", { name: "Realism" }).click();
    await continueBtn(page).click(); // → captions
    await page.getByRole("button", { name: /Bold Stroke/ }).click();
    await continueBtn(page).click(); // → schedule
  }

  test("a disabled button says why, two-letter niches work and the bar has one segment per step", async ({ page }) => {
    await signedInUser(page);
    await page.goto("/dashboard/create/");
    await expect(continueBtn(page)).toBeDisabled();
    await expect(page.locator("#step-problem")).toHaveText("Choose at least one format.");
    await page.getByRole("button", { name: /^Fun Facts/ }).click();
    await expect(page.locator("#step-problem")).toContainText("at least 2 characters");
    await page.locator("#niche").fill("F1");
    await expect(continueBtn(page)).toBeEnabled();
    await expect(page.locator("#step-problem")).toHaveCount(0);
    await expect(page.locator(".mb-8 > span")).toHaveCount(6);
  });

  test("a pasted link doesn't become the series name; the posting time zone is shown", async ({ page }) => {
    await signedInUser(page);
    await page.goto("/dashboard/create/");
    await page.getByRole("button", { name: /^Storytelling/ }).click();
    await page.locator("#niche").fill("https://www.tiktok.com/@aleksandra.wisniewska.k/video/7436291847562918273?is_from_webapp=1 histórias de terror");
    await continueBtn(page).click();
    await finishSteps(page);
    await expect(page.locator("#name")).toHaveValue("histórias de terror");
    await expect(page.getByRole("button", { name: "Create Series" })).toBeEnabled();
    await expect(page.getByTestId("timezone-hint")).toContainText("Times are in UTC");
  });

  test("an unfinished wizard survives leaving the page, and Start over clears it", async ({ page }) => {
    await signedInUser(page);
    await page.goto("/dashboard/create/");
    await page.getByRole("button", { name: /^Storytelling/ }).click();
    await page.locator("#niche").fill("Aleksandra Wiśniewska-Kowalczyk conta lendas da Polônia");
    await continueBtn(page).click();
    await page.getByRole("button", { name: /^Marcus/ }).click();

    await page.getByRole("link", { name: "Series" }).first().click(); // in-app navigation away
    await expect(page).toHaveURL(/\/dashboard\/series\/$/);
    await page.goto("/dashboard/create/");
    await expect(page.getByText("We kept the series you were creating.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Language & Voice" })).toBeVisible();
    await expect(continueBtn(page)).toBeEnabled(); // Marcus is still chosen

    await page.getByRole("button", { name: "Start over" }).click();
    await expect(page.getByRole("heading", { name: "Choose Formats & Niche" })).toBeVisible();
    await expect(page.locator("#niche")).toHaveValue("");
  });

  test("the suggested name keeps capital letters", async ({ page }) => {
    await signedInUser(page);
    await page.goto("/dashboard/create/");
    await page.getByRole("button", { name: /^Storytelling/ }).click();
    await page.locator("#niche").fill("Aleksandra Wiśniewska-Kowalczyk conta lendas da Polônia");
    await continueBtn(page).click();
    await finishSteps(page);
    await expect(page.locator("#name")).toHaveValue("Aleksandra Wiśniewska-Kowalczyk conta");
  });

  test("without credits the wizard warns, and the series page explains the missing first video", async ({ page }) => {
    // The "empty" dataset has a balance of 0. (Spending 60 real credits per run made the whole
    // suite flaky; the API's 402 itself is covered by the createVideo integration test.)
    await signedInUser(page);
    await page.goto("/dashboard/create/?data=empty");
    await page.getByRole("button", { name: /^Storytelling/ }).click();
    await page.locator("#niche").fill("Histórias de pescador");
    await continueBtn(page).click();
    await finishSteps(page);
    await expect(page.getByRole("note")).toContainText("You're out of credits");

    // What the wizard sends the user to when the first video gets a 402.
    const id = await createSeriesViaApi(page);
    await page.goto(`/dashboard/series/${id}/?first=no-credits`);
    await expect(page.getByRole("status").filter({ hasText: "first video wasn't made because you're out of credits" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/dashboard/series/${id}/$`)); // the notice parameter is cleaned
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
