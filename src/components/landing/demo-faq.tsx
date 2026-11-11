"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Play, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { LogoMark } from "../icons";
import { MiniDashboard } from "../mini-dashboard";

function DemoThumbnail() {
  return (
    <div className="relative w-full aspect-video rounded-md border shadow-lg overflow-hidden bg-[#f5f5f5] transition-all duration-200 ease-out group-hover:brightness-[0.8]">
      <svg viewBox="0 0 160 90" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <g stroke="#6d28d9" strokeLinecap="round" fill="none">
          <path d="M0 18 L12 0" strokeWidth="2.4" />
          <path d="M4 9 L10 0" strokeWidth="1.2" />
          <path d="M140 8 L160 0" strokeWidth="1.6" />
          <path d="M146 16 L160 6" strokeWidth="2.2" />
          <path d="M0 82 L10 74" strokeWidth="1.6" />
          <path d="M6 90 L22 74" strokeWidth="2.4" />
          <path d="M18 90 L28 82" strokeWidth="1.4" />
          <path d="M134 90 L150 64" strokeWidth="2.4" />
          <path d="M146 90 L160 66" strokeWidth="2.8" />
          <path d="M156 90 L160 82" strokeWidth="1.6" />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 md:gap-3">
        <div className="flex items-center gap-2 md:gap-3 font-heading text-lg md:text-4xl font-extrabold">
          <LogoMark className="w-6 h-6 md:w-10 md:h-10 text-primary" />
          {BRAND}
        </div>
        <div className="font-heading text-2xl md:text-5xl font-black uppercase leading-tight text-center text-black">
          How to create
          <br />a series
        </div>
      </div>
    </div>
  );
}

export function SeeItInAction() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <section className="py-10 sm:py-16 md:py-20">
      <div className="container mx-auto px-6 sm:px-8 md:px-10">
        <div className="text-center mb-8 sm:mb-12 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4">See It In Action</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            Watch how easy it is to create viral faceless reels from start to finish
          </p>
        </div>
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <button type="button" className="group relative cursor-pointer block w-full" aria-label="Play demo video" onClick={() => setOpen(true)}>
              <DemoThumbnail />
              <div className="absolute inset-0 flex scale-[0.9] items-center justify-center rounded-2xl transition-all duration-200 ease-out group-hover:scale-100">
                <div className="flex size-28 items-center justify-center rounded-full bg-primary/10 backdrop-blur-md">
                  <div className="relative flex size-20 scale-100 items-center justify-center rounded-full bg-gradient-to-b from-primary/30 to-primary shadow-md transition-all duration-200 ease-out group-hover:scale-[1.2]">
                    <Play className="size-8 scale-100 fill-white text-white transition-transform duration-200 ease-out group-hover:scale-105" />
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute -top-12 right-0 rounded-full bg-neutral-900/50 p-2 text-white ring-1 backdrop-blur-md"
              aria-label="Close video"
              onClick={() => setOpen(false)}
            >
              <X className="size-5" />
            </button>
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-white">
              <MiniDashboard view="create" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const FAQS: [string, string][] = [
  ["What is a series?", "A series is a set of videos built around one topic. You choose the niche, voice, music and look once, and new videos in that series are created and posted for you automatically."],
  ["Is it easy to use?", "Very. Create a series, connect your social accounts and the videos are produced and published on autopilot."],
  ["Do I need to be a content creation expert?", "No. Scripts, voiceover, visuals and captions are all generated for you, so no editing or filming skills are needed."],
  ["What social media platforms are supported?", "You can post automatically to TikTok, Instagram and YouTube."],
  ["Is it safe to connect my TikTok, Instagram and YouTube account?", "Yes. Accounts are connected through each platform's official sign-in, we never see your password, and you can disconnect at any time."],
  ["How many videos can I create per month?", "That depends on your plan. Each video uses one credit, and your credits renew every month."],
  ["How do I make sure I get views?", "Pick a clear niche, post consistently and keep your series running. Consistent posting is what the platforms reward most."],
  ["Can I get a refund?", "If something goes wrong, contact support and we will review your request according to our refund policy."],
];

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [render, setRender] = useState(open);

  useEffect(() => {
    if (open) setRender(true);
  }, [open]);

  useEffect(() => {
    if (render && inner.current) setHeight(inner.current.scrollHeight);
  }, [render, open]);

  const state = open ? "open" : "closed";
  return (
    <div className="border-b" data-state={state}>
      <h3 className="flex" data-state={state}>
        <button
          type="button"
          aria-expanded={open}
          data-state={state}
          onClick={onToggle}
          className="flex flex-1 items-center justify-between py-4 transition-all hover:underline [&[data-state=open]>svg]:rotate-180 text-left font-semibold text-sm sm:text-base"
        >
          {q}
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
        </button>
      </h3>
      <div
        role="region"
        data-state={state}
        hidden={!render}
        onAnimationEnd={() => !open && setRender(false)}
        style={{ ["--acc-h" as string]: `${height}px` }}
        className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      >
        <div ref={inner} className="pb-4 pt-0 text-muted-foreground">
          {a}
        </div>
      </div>
    </div>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="py-10 sm:py-16 md:py-20" id="faq">
      <div className="container mx-auto px-6 sm:px-8 md:px-10">
        <div className="text-center mb-8 sm:mb-10 md:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4">Frequently Asked Questions</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">Everything you need to know about {BRAND}</p>
        </div>
        <div className="max-w-3xl mx-auto">
          <div className="w-full">
            {FAQS.map(([q, a], i) => (
              <FaqItem key={q} q={q} a={a} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
