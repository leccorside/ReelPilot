import { expect, test } from "@playwright/test";
import { formError, PASSWORD, registerViaApi, signedInUser, signInViaUi, uniqueEmail } from "./helpers";

/** The home page exactly (a bare /\/$/ would also match /dashboard/series/). */
const HOME = /^https?:\/\/[^/]+\/$/;

test.describe("sign-up and sign-in", () => {
  test("creating an account through the dialog lands on the dashboard", async ({ page }) => {
    const email = uniqueEmail("signup");
    await page.goto("/login/");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password", { exact: true }).fill(PASSWORD);
    await page.getByPlaceholder("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/dashboard\/series\/$/);
    // The user menu shows the account (name defaults to the part before the @).
    await expect(page.getByText(email.split("@")[0]).first()).toBeVisible();
  });

  test("an e-mail that already has an account is refused", async ({ page }) => {
    const email = await registerViaApi(page);
    await page.goto("/login/");
    await page.getByPlaceholder("Email").fill(email.toUpperCase());
    await page.getByPlaceholder("Password", { exact: true }).fill(PASSWORD);
    await page.getByPlaceholder("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(formError(page)).toHaveText("An account with this email already exists.");
    await expect(page).toHaveURL(/\/login\/$/);
  });

  test("a wrong password shows an error, the right one goes to the requested page", async ({ page }) => {
    const email = await registerViaApi(page);
    await signInViaUi(page, email, "not-the-password", "/dashboard/billing/");
    await expect(formError(page)).toHaveText("Incorrect email or password.");

    await page.getByPlaceholder("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/billing\/$/);
  });

  test("Google sign-in explains when it is not configured", async ({ page }) => {
    await page.goto("/login/");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(formError(page)).toHaveText(/Google sign-in isn't available yet/);
  });
});

test.describe("protected routes", () => {
  test("a signed-out visitor is sent to the login and comes back after signing in", async ({ page }) => {
    await page.goto("/dashboard/videos/");
    await expect(page).toHaveURL(/\/login\/\?callbackUrl=%2Fdashboard%2Fvideos%2F$/);

    const email = await registerViaApi(page);
    await page.getByRole("button", { name: "Already have an account? Sign in" }).click();
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/videos\/$/);
  });

  test("private API routes answer 401 without a session", async ({ request }) => {
    const res = await request.patch("/api/account/", { data: { name: "x" } });
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "Not signed in" });
  });

  test("an external callbackUrl is ignored", async ({ page }) => {
    const email = await registerViaApi(page);
    await signInViaUi(page, email, PASSWORD, "https://evil.example/");
    await expect(page).toHaveURL(/\/dashboard\/series\/$/);
  });
});

test.describe("account", () => {
  test("signing out ends the session; the login page sends signed-in users onward", async ({ page }) => {
    await signedInUser(page);
    await page.goto("/login/?callbackUrl=%2Fdashboard%2Fsettings%2F");
    await expect(page).toHaveURL(/\/dashboard\/settings\/$/);

    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(HOME);
    await page.goto("/dashboard/series/");
    await expect(page).toHaveURL(/\/login\//);
  });

  test("the profile name is saved on the server", async ({ page }) => {
    await signedInUser(page);
    await page.goto("/dashboard/settings/");
    const name = page.getByLabel("Name");
    await name.fill("Ana Pereira");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Profile saved")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Name")).toHaveValue("Ana Pereira");
  });

  test("deleting the account signs out and the e-mail can no longer sign in", async ({ page }) => {
    const email = await signedInUser(page);
    await page.goto("/dashboard/settings/");
    await page.getByRole("button", { name: "Delete account" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete account" }).click();
    await expect(page).toHaveURL(HOME);

    await signInViaUi(page, email);
    await expect(formError(page)).toHaveText("Incorrect email or password.");
  });
});
