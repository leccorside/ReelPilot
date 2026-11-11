"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { Avatar, Scene } from "../art";
import { TiktokIcon } from "../icons";

const CHANNELS = [
  { name: "Dark History", handle: "@dark.history.tales", tiles: [["AMERICANS", "745.1K", 3], ["1957", "663.9K", 7], ["LAB", "1.3M", 5]] },
  { name: "Daily Mysteries", handle: "@daily.mysteries", tiles: [["NIGHT", "512.4K", 0], ["LOST", "988.2K", 6], ["DOOR", "2.1M", 2]] },
  { name: "Ancient Tales", handle: "@ancient.tales", tiles: [["ONE", "138.3K", 1], ["15000", "194.9K", 4], ["KING", "175.4K", 3]] },
] as const;

export function Views() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setIndex((i) => (i + 1) % CHANNELS.length), 5000);
    return () => window.clearInterval(t);
  }, [index]);

  const go = (d: number) => setIndex((i) => (i + d + CHANNELS.length) % CHANNELS.length);
  const current = CHANNELS[index];

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-6 sm:px-8 md:px-10">
        <div className="max-w-5xl mx-auto space-y-8 md:space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-3xl font-semibold">We actually get views</h2>
            <p className="text-muted-foreground text-sm md:text-base text-balance">Real channels getting millions of views with our AI tool.</p>
          </div>
          <div className="relative" aria-roledescription="carousel" aria-live="polite">
            <div className="md:max-w-3xl mx-auto flex justify-end mb-2">
              <div role="group" className="inline-flex items-center divide-x rounded-md border bg-background text-xs" aria-label="Carousel controls">
                <button className="px-2 py-1 hover:bg-muted/50 focus:outline-none" aria-label="Previous slide" type="button" onClick={() => go(-1)}>
                  &lt;
                </button>
                <button className="px-2 py-1 hover:bg-muted/50 focus:outline-none" aria-label="Next slide" type="button" onClick={() => go(1)}>
                  &gt;
                </button>
              </div>
            </div>
            <div className="relative md:max-w-3xl mx-auto w-full overflow-hidden rounded-xl border bg-muted/20 cursor-pointer transition-transform hover:scale-[1.01]" onClick={() => go(1)}>
              <div className="aspect-[21/9] w-full relative">
                {CHANNELS.map((c, ci) => (
                  <div
                    key={c.handle}
                    className={`absolute inset-0 transition-opacity duration-700 grid grid-cols-3 gap-[2px] bg-white ${ci === index ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                    aria-label={`${c.name} ${c.handle}`}
                  >
                    {c.tiles.map(([word, views, v]) => (
                      <div key={word} className="relative h-full overflow-hidden">
                        <Scene variant={v} word={word} className="absolute inset-0" wordClass="text-xs md:text-xl" />
                        <span className="absolute left-1 top-1 md:left-3 md:top-2 rounded-sm md:rounded bg-[#fe2c55] px-1 md:px-2 text-[9px] md:text-xl font-medium text-white">Pinned</span>
                        <span className="absolute left-1 bottom-1 md:left-3 md:bottom-2 flex items-center gap-1 text-[9px] md:text-2xl font-medium text-white drop-shadow">
                          <Play className="w-2.5 h-2.5 md:w-6 md:h-6" />
                          {views}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-3 md:px-4 md:py-4 border-t bg-background/60 backdrop-blur">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={current.name} index={index + 2} className="h-10 w-10 md:h-12 md:w-12 bg-zinc-900" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm md:text-base font-semibold truncate">{current.name}</p>
                      <TiktokIcon className="w-3 h-3" aria-label="TikTok" />
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{current.handle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2">
                  {CHANNELS.map((c, ci) => (
                    <span key={c.handle} className={`h-1.5 md:h-2 w-1.5 md:w-2 rounded-full transition-colors ${ci === index ? "bg-foreground" : "bg-muted-foreground/30"}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="pt-2">
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-row items-center justify-center gap-6 md:gap-16">
                <Counter start={1222787} label="channels automated" />
                <div className="w-px h-8 bg-border" />
                <Counter start={2669249} label="videos autoposted" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A live-looking total: it ticks up a little every couple of seconds. */
function Counter({ start, label }: { start: number; label: string }) {
  const [value, setValue] = useState(start);
  useEffect(() => {
    const t = window.setInterval(() => setValue((v) => v + 1 + Math.floor(Math.random() * 3)), 2500);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="text-center">
      <div className="text-2xl md:text-3xl text-primary mb-1.5 font-semibold">
        <span className="inline-block tracking-wider tabular-nums">{value.toLocaleString("en-US")}</span>
        <span>+</span>
      </div>
      <p className="text-muted-foreground text-xs md:text-sm">{label}</p>
    </div>
  );
}
