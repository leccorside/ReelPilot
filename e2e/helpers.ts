import { expect, type Page } from "@playwright/test";

export const PASSWORD = "e2e-password-123";

export const uniqueEmail = (tag = "e2e") => `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.dev`;

/** Error message of the login dialog (Next.js also has a page-level role="alert" route announcer). */
export const formError = (page: Page) => page.getByRole("dialog").getByRole("alert");

/** Creates an account through the API (fast) and returns its e-mail. */
export async function registerViaApi(page: Page, email = uniqueEmail()) {
  const res = await page.request.post("/api/register/", { data: { email, password: PASSWORD } });
  expect(res.status(), await res.text()).toBe(201);
  return email;
}

/** Signs in through the real login dialog. */
export async function signInViaUi(page: Page, email: string, password = PASSWORD, callbackUrl?: string) {
  await page.goto(callbackUrl ? `/login/?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login/");
  await page.getByRole("button", { name: "Already have an account? Sign in" }).click();
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export const WIZARD = {
  name: "E2E Mysteries",
  formats: ["storytelling"],
  niche: "Unsolved mysteries and true crime",
  language: "en",
  voice: "adam",
  artStyle: "realism",
  captionStyle: "bold",
  platforms: [],
  frequency: "daily",
  postTime: "18:00",
};

/** Creates a series for the signed-in user through the API; returns its id. */
export async function createSeriesViaApi(page: Page, overrides: Record<string, unknown> = {}) {
  const res = await page.request.post("/api/series/", { data: { ...WIZARD, ...overrides } });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

/** "balance/allowance" shown in the sidebar. */
export const creditsLeft = (page: Page) => page.getByTestId("credits-left");

/** A fresh, signed-in account; ends on the dashboard. */
export async function signedInUser(page: Page) {
  const email = await registerViaApi(page);
  await signInViaUi(page, email);
  await expect(page).toHaveURL(/\/dashboard\/series\/$/);
  return email;
}
