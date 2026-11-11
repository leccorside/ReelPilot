"use client";

import { getProviders, signIn } from "next-auth/react";

/** Starts the Google OAuth flow; returns false when Google sign-in is not configured on the server. */
export async function startGoogleSignIn(callbackUrl: string): Promise<boolean> {
  const providers = await getProviders().catch(() => null);
  if (!providers?.google) return false;
  await signIn("google", { redirectTo: callbackUrl });
  return true;
}
