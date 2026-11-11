// Helpers shared by the login page (server) and the sign-in UI (browser).

export const DEFAULT_AFTER_LOGIN = "/dashboard/series/";

/**
 * Only same-site paths are accepted as "callbackUrl" (prevents open redirects such as
 * /login?callbackUrl=https://evil.example). Absolute URLs on our own origin are reduced to their path.
 */
export function safeCallbackUrl(raw: string | null | undefined, origin?: string): string {
  if (!raw) return DEFAULT_AFTER_LOGIN;
  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (!origin || url.origin !== new URL(origin).origin) return DEFAULT_AFTER_LOGIN;
      path = `${url.pathname}${url.search}`;
    } catch {
      return DEFAULT_AFTER_LOGIN;
    }
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return DEFAULT_AFTER_LOGIN;
  if (path === "/login" || path.startsWith("/login/") || path.startsWith("/login?")) return DEFAULT_AFTER_LOGIN;
  return path;
}

/** Messages for the `error` query parameter (Auth.js redirects) and the Credentials `code`. */
export function authErrorMessage(code: string | null | undefined): string | null {
  switch (code) {
    case null:
    case undefined:
    case "":
      return null;
    case "invalid_credentials":
    case "CredentialsSignin":
      return "Incorrect email or password.";
    case "rate_limited":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "GoogleUnavailable":
      return "Google sign-in isn't available yet. Use your email and password.";
    case "OAuthAccountNotLinked":
      return "This email is already linked to another sign-in method.";
    case "AccessDenied":
      return "Access denied.";
    case "Configuration":
      return "Sign-in is temporarily unavailable. Please try again later.";
    default:
      return "Something went wrong. Please try again.";
  }
}
