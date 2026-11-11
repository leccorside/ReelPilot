import Link from "next/link";
import { Zap } from "lucide-react";
import { InstagramIcon, TiktokIcon, YoutubeIcon } from "../icons";
import { Portrait, Scene } from "../art";
import { Marquee } from "../marquee";

const USERS = ["Ava Stone", "Ben Ortiz", "Cleo Park", "Dan Reyes", "Eli Novak"];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-2 md:pt-32 md:pb-24 lg:pt-32 lg:pb-10">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-0" />
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 blur-[100px] opacity-0" />
      </div>
      <div className="container mx-auto px-6 sm:px-8 md:px-10 max-w-4xl">
        <div className="text-center">
          <div className="w-full">
            <div className="flex items-center justify-center gap-3 md:gap-4 mb-6 md:mb-8">
              <div className="flex -space-x-2">
                {USERS.map((u, i) => (
                  <Portrait key={u} index={i} className="h-8 w-8 md:h-10 md:w-10 ring-2 ring-background" />
                ))}
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                Trusted by <span className="font-semibold text-foreground tabular-nums">2M+</span> users
              </p>
            </div>
          </div>
          <h1 className="max-w-2xl mx-auto text-4xl sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl tracking-tight font-bold text-balance mb-6 md:mb-8">
            Create viral faceless videos on auto-pilot
          </h1>
          <div className="space-y-8">
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed text-balance">
              The only AI that generates &amp; posts videos for you automatically, even while you sleep.
            </p>
            <div className="flex items-center justify-center gap-3 md:gap-4">
              <span className="text-sm md:text-base text-muted-foreground">Perfect for</span>
              <div className="flex items-center gap-3 md:gap-4 text-muted-foreground">
                <YoutubeIcon className="w-6 h-6 md:w-7 md:h-7" />
                <InstagramIcon className="w-5 h-5 md:w-6 md:h-6" />
                <TiktokIcon className="w-5 h-5 md:w-6 md:h-6" />
              </div>
            </div>
            <div className="pt-4">
              <Link
                href="/login/"
                className="relative text-center cursor-pointer inline-flex justify-center items-center rounded-lg text-white px-6 py-3 shadow-lg bg-primary hover:bg-primary/90 text-lg md:text-xl font-semibold mx-auto"
              >
                <div className="relative z-10 flex items-center">
                  <Zap className="w-5 h-5 mr-3 fill-white" />
                  Create your first video
                </div>
                <div className="absolute top-1/2 left-1/2 size-full rounded-lg bg-inherit animate-pulse -translate-x-1/2 -translate-y-1/2" />
              </Link>
              <p className="text-sm text-muted-foreground mt-4">Get your generated video in less than 5 minutes.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const NICHES: [string, string][] = [
  ["Mythology", "GODS"],
  ["School gossip", "SECRET"],
  ["Scary stories", "WILD"],
  ["History", "SONS"],
  ["Act of kindness", "FOR"],
  ["Biblical stories", "BURNS"],
  ["Anime stories", "STUDENTS"],
  ["Heists", "TWO"],
];

function ArrowDoodle() {
  return (
    <svg viewBox="0 0 60 60" className="w-[60px] h-[60px] text-foreground" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M6 14 C 22 6, 40 14, 42 44" />
      <path d="M34 36 L42 46 L48 35" />
    </svg>
  );
}

export function Examples() {
  return (
    <section className="pt-10 pb-4 sm:pb-10 relative" id="examples">
      <div className="container mx-auto px-6 sm:px-8 md:px-10 relative">
        <div className="absolute left-[25%] -top-20 z-10 hidden md:block">
          <div className="relative">
            <ArrowDoodle />
            <span className="absolute text-lg font-semibold whitespace-nowrap top-0 -left-64">Creates videos for any niche</span>
          </div>
        </div>
        <div className="relative w-full flex-col items-center justify-center overflow-hidden">
          <Marquee duration="60s">
            {NICHES.map(([label, word], i) => (
              <div key={label} className="relative h-full w-32 sm:w-36 md:w-52 overflow-hidden rounded-xl mx-1 sm:mx-2 border-border bg-background/50">
                <div className="aspect-[9/16] w-full overflow-hidden relative">
                  <Scene variant={i} word={word} className="h-full w-full" wordClass="text-sm md:text-lg" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5 text-xs text-center text-white z-10">{label}</div>
                </div>
              </div>
            ))}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-background" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-background" />
        </div>
      </div>
    </section>
  );
}
