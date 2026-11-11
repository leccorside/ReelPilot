import { chromium, type FullConfig } from "@playwright/test";
import { PASSWORD, uniqueEmail } from "./helpers";

/**
 * Global setup: visits every dashboard page once, signed in, so the development server compiles
 * them before the parallel tests start (cold compiles were the cause of flaky timeouts).
 */
export default async function warmup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  const email = uniqueEmail("warmup");
  await page.request.post("/api/register/", { data: { email, password: PASSWORD } });
  const { csrfToken } = (await (await page.request.get("/api/auth/csrf")).json()) as { csrfToken: string };
  await page.request.post("/api/auth/callback/credentials", { form: { csrfToken, email, password: PASSWORD } });
  const series = (await (
    await page.request.post("/api/series/", {
      data: { name: "Warm-up", formats: ["facts"], niche: "Warm-up", language: "en", voice: "adam", artStyle: "realism", captionStyle: "bold", frequency: "daily", postTime: "10:00" },
    })
  ).json()) as { id: string };
  for (const path of ["/", "/login/", "/dashboard/series/", "/dashboard/create/", `/dashboard/series/${series.id}/`, `/dashboard/series/${series.id}/edit/`, "/dashboard/videos/", "/dashboard/settings/", "/dashboard/billing/"]) {
    await page.goto(path, { timeout: 120_000 });
  }
  await page.request.delete("/api/account/");
  await browser.close();
}
