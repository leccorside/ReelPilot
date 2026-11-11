import type { ReactNode } from "react";

/** Endless scrolling strip: the content is repeated and slid by its own length, pausing on hover. */
export function Marquee({
  children,
  vertical = false,
  reverse = false,
  duration = "60s",
  repeat = 4,
  className = "",
}: {
  children: ReactNode;
  vertical?: boolean;
  reverse?: boolean;
  duration?: string;
  repeat?: number;
  className?: string;
}) {
  return (
    <div
      className={`group flex overflow-hidden p-2 [--gap:1rem] [gap:var(--gap)] ${vertical ? "flex-col" : "flex-row"} ${className}`}
      style={{ ["--duration" as string]: duration }}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          aria-hidden={i > 0}
          className={`flex shrink-0 justify-around [gap:var(--gap)] group-hover:[animation-play-state:paused] ${
            vertical ? "animate-marquee-vertical flex-col" : "animate-marquee flex-row"
          } ${reverse ? "[animation-direction:reverse]" : ""}`}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
