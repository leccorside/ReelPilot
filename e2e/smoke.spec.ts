import { expect, test } from "@playwright/test";
import { createSeriesViaApi, signedInUser } from "./helpers";

test("home page renders the hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/ReelPilot/);
});

test("login page shows the sign-up form", async ({ page }) => {
  await page.goto("/login/");
  await expect(page.getByText("Create account").first()).toBeVisible();
});

test("health endpoint reports every service as up", async ({ request }) => {
  const res = await request.get("/api/health/");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(Object.values(body.checks).every((c) => (c as { ok: boolean }).ok)).toBe(true);
});

test("dashboard redirects to series, and a series opens on its own route", async ({ page }) => {
  await signedInUser(page);
  const id = await createSeriesViaApi(page);

  await page.goto("/dashboard/");
  await expect(page).toHaveURL(/\/dashboard\/series\/$/);
  await page.getByRole("link", { name: "E2E Mysteries" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/series/${id}/$`));
  await expect(page.getByRole("heading", { name: "E2E Mysteries" })).toBeVisible();
});
