"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { ChevronRight, CreditCard, Eye, EyeOff, Film, Layers, Loader2, Settings } from "lucide-react";
import { Logo } from "@/components/logo";
import { GoogleIcon } from "@/components/icons";
import { buttonClass } from "@/components/button";
import { authErrorMessage } from "@/lib/auth-shared";

const input =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground placeholder:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function PasswordField({ value, onChange, placeholder, autoComplete }: { value: string; onChange: (v: string) => void; placeholder: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className={`${input} pr-10`}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onClick={() => setShow((s) => !s)}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** The dashboard as it sits blurred behind the sign-in dialog. */
function BlurredDashboard() {
  return (
    <div className="flex h-screen blur-[6px] pointer-events-none select-none" aria-hidden>
      {/* Signed-out sidebar as the original shows it: taller logo row, roomier items, no credits. */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-background border-r">
        <div className="h-20 px-10 pt-5">
          <Logo className="text-lg" />
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {[Layers, Film, Settings, CreditCard].map((Icon, i) => (
            <div key={i} className={`flex items-center gap-3 rounded-md px-3 py-2 text-base font-medium ${i === 0 ? "bg-[#09090b0d]" : ""}`}>
              <Icon className="h-4 w-4" />
              {["Series", "Videos", "Settings", "Billing"][i]}
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1">
        <div className="flex h-16 items-center gap-2 border-b px-6 text-sm text-muted-foreground">
          <span>Series</span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Create New Series</span>
        </div>
        <div className="lg:px-8">
          <div className="mx-auto max-w-2xl px-6 pt-4 space-y-6">
            <div className="flex gap-3">
              <span className="h-7 w-24 rounded-full bg-primary/30" />
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className="h-5 w-20 rounded bg-muted" />
              ))}
            </div>
            <div className="h-5 w-64 rounded bg-muted" />
            <div className="h-4 w-80 rounded bg-muted" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 rounded-xl bg-muted/70" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

type Props = {
  /** Already validated on the server (same-site path only). */
  callbackUrl: string;
  googleEnabled: boolean;
  /** `error` query parameter set by Auth.js redirects. */
  errorCode: string | null;
};

function LoginDialog({ callbackUrl, googleEnabled, errorCode }: Props) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(authErrorMessage(errorCode));
  const [busy, setBusy] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const valid = mode === "signup" ? emailOk && password.length >= 8 && password === confirm : emailOk && password.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/register/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? "Could not create the account. Please try again.");
          return;
        }
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result || result.error) {
        setError(authErrorMessage(result?.code || "invalid_credentials"));
        return;
      }
      // Full navigation so the dashboard starts with the new session cookie.
      window.location.assign(callbackUrl);
    } catch {
      setError(authErrorMessage("unknown"));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    if (!googleEnabled) {
      setError(authErrorMessage("GoogleUnavailable"));
      return;
    }
    setBusy(true);
    await signIn("google", { redirectTo: callbackUrl });
  };

  const hint =
    mode === "signup" && password && password.length < 8
      ? "Password must be at least 8 characters."
      : mode === "signup" && confirm && confirm !== password
        ? "Passwords do not match."
        : null;

  return (
    <div
      role="dialog"
      aria-labelledby="auth-title"
      className="fixed left-[50%] top-[50%] z-[51] grid w-full max-w-[420px] translate-x-[-50%] translate-y-[-50%] border bg-background p-6 shadow-lg sm:rounded-lg"
    >
      <div className="space-y-2 mb-6">
        <h1 id="auth-title" className="text-2xl font-semibold tracking-tight">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {mode === "signup" ? "Enter your details to create your account" : "Sign in to your account to continue"}
        </p>
      </div>
      <button type="button" className={buttonClass("outline", "default", "w-full bg-white")} onClick={google} disabled={busy}>
        <GoogleIcon className="h-4 w-4" />
        Continue with Google
      </button>
      <div className="relative my-6 flex items-center">
        <span className="flex-1 border-t" />
        <span className="px-2 text-xs uppercase text-muted-foreground">or</span>
        <span className="flex-1 border-t" />
      </div>
      <form className="space-y-4" onSubmit={submit} noValidate>
        <input type="email" className={input} placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={(e) => setEmail(e.target.value)} />
        <PasswordField value={password} onChange={setPassword} placeholder="Password" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        {mode === "signup" && <PasswordField value={confirm} onChange={setConfirm} placeholder="Confirm password" autoComplete="new-password" />}
        {(error || hint) && (
          <p role="alert" className="text-xs text-destructive">
            {error || hint}
          </p>
        )}
        {mode === "signup" ? (
          <p className="text-xs text-center text-muted-foreground">
            By creating an account, you agree to our{" "}
            <Link href="/tos/" className="underline hover:text-foreground">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy/" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
          </p>
        ) : (
          <p className="text-xs text-right">
            {/* Password reset by e-mail arrives with the e-mail step (Passo 16). */}
            <button type="button" className="text-muted-foreground underline hover:text-foreground" onClick={() => setError("Password reset by email isn't available yet. Please contact us through the contact page.")}>
              Forgot password?
            </button>
          </p>
        )}
        <button type="submit" disabled={!valid || busy} className={buttonClass("primary", "default", "w-full")}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
      <div className="mt-6 text-center">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground underline"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
            setConfirm("");
          }}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}

export function LoginView(props: Props) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <BlurredDashboard />
      <div className="fixed inset-0 z-50 bg-white/10" />
      <LoginDialog {...props} />
    </div>
  );
}
