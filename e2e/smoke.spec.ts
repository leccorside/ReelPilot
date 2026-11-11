import { expect, test } from "@playwright/test";

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
  // The dashboard still reads the browser store (replaced by the API in Passo 3): seed it.
  await page.addInitScript(() => {
    const user = { name: "E2E", email: "e2e@example.com", provider: "google" };
    window.localStorage.setItem(
      "reelpilot-db-v1",
      JSON.stringify({
        user,
        accounts: [user],
        series: [
          {
            id: "s1e2e",
            name: "E2E Mysteries",
            type: "Voiceover",
            formats: ["storytelling"],
            niche: "Unsolved mysteries",
            language: "en",
            voice: "adam",
            musicUrls: [],
            musicFiles: [],
            artStyle: "realism",
            captionStyle: "bold",
            platforms: [],
            frequency: "1 video per day",
            postTime: "18:00",
            status: "active",
            createdAt: Date.now(),
          },
        ],
        videos: [],
      }),
    );
  });

  await page.goto("/dashboard/");
  await expect(page).toHaveURL(/\/dashboard\/series\/$/);
  await page.getByRole("link", { name: "E2E Mysteries" }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/series\/s1e2e\/$/);
  await expect(page.getByRole("heading", { name: "E2E Mysteries" })).toBeVisible();
});
