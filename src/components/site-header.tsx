"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { GoogleIcon } from "./icons";
import { buttonClass } from "./button";
import { signInWithGoogle } from "@/lib/store";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const google = () => {
    signInWithGoogle();
    router.push("/dashboard/series/");
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex flex-col font-sans">
      <header
        className={`w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all border-b ${
          scrolled ? "border-border" : "border-transparent"
        }`}
      >
        <div className="container mx-auto">
          <div className="flex h-16 items-center justify-between">
            <Link className="flex items-center space-x-2" href="/">
              <Logo />
            </Link>
            <button className="md:hidden flex items-center" aria-label="Toggle menu" onClick={() => setOpen((o) => !o)}>
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <nav className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 items-center space-x-10 text-sm font-medium text-muted-foreground">
              <Link href="/#how-it-works" className="hover:text-foreground transition-colors">
                How it works
              </Link>
              <Link href="/#faq" className="hover:text-foreground transition-colors">
                FAQ
              </Link>
            </nav>
            <div className="hidden md:flex items-center gap-2">
              <button className={buttonClass("outline", "default", "bg-white")} onClick={google}>
                <GoogleIcon className="h-4 w-4" />
                Sign in with Google
              </button>
              <Link href="/login/" className={buttonClass("primary")}>
                Get started
              </Link>
            </div>
          </div>
        </div>
        {open && (
          <div className="md:hidden container mx-auto pb-6">
            <div className="border-t border-border" />
            <nav className="flex flex-col pt-2 text-sm text-muted-foreground">
              <Link href="/#how-it-works" onClick={() => setOpen(false)} className="px-2 py-4 hover:text-foreground">
                How it works
              </Link>
              <Link href="/#faq" onClick={() => setOpen(false)} className="px-2 py-4 hover:text-foreground">
                FAQ
              </Link>
            </nav>
            <div className="flex flex-col gap-2 pt-2 px-2">
              <button className={buttonClass("outline", "default", "w-full bg-white font-medium")} onClick={google}>
                <GoogleIcon className="h-4 w-4" />
                Sign in with Google
              </button>
              <Link href="/login/" onClick={() => setOpen(false)} className={buttonClass("primary", "default", "w-full")}>
                Get started
              </Link>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}
