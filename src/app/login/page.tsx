import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { safeCallbackUrl } from "@/lib/auth-shared";
import { env } from "@/lib/env";
import { LoginView } from "./login-view";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: { callbackUrl?: string; error?: string } }) {
  const e = env();
  const callbackUrl = safeCallbackUrl(searchParams.callbackUrl, e.APP_URL);

  // Already signed in: go straight to where the visitor was heading.
  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  return (
    <LoginView
      callbackUrl={callbackUrl}
      googleEnabled={Boolean(e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET)}
      errorCode={searchParams.error ?? null}
    />
  );
}
