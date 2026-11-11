import { InstagramIcon, TiktokIcon, YoutubeIcon } from "../icons";

function ViewBadge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`absolute flex items-center gap-1 rounded-lg border-2 border-violet-300 bg-violet-100/90 px-2 py-0.5 font-heading text-base md:text-xl font-bold text-violet-700 shadow ${className}`}
    >
      <span className="inline-block h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-violet-700" />
      {label}
    </span>
  );
}

/** Platform tiles riding a rising arrow, standing in for the original's step-3 illustration. */
export function GrowthArt() {
  return (
    <div className="relative w-full max-w-[32rem] h-full">
      <svg viewBox="0 0 512 300" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="growth" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0" stopColor="#6ee7b7" stopOpacity="0" />
            <stop offset="0.3" stopColor="#6ee7b7" />
            <stop offset="1" stopColor="#5eead4" />
          </linearGradient>
        </defs>
        <path d="M10 300 L120 190 L190 240 L300 120 L360 160 L450 40" stroke="url(#growth)" strokeWidth="34" fill="none" strokeLinejoin="round" />
        <path d="M420 30 L480 10 L470 70Z" fill="#5eead4" />
      </svg>
      <div className="absolute left-[14%] top-[18%] flex h-24 w-24 md:h-28 md:w-28 items-center justify-center rounded-3xl bg-zinc-900 shadow-xl -rotate-6">
        <TiktokIcon className="h-14 w-14 text-white drop-shadow-[2px_2px_0_#fe2c55]" />
      </div>
      <div className="absolute left-[46%] top-[30%] flex h-20 w-24 md:h-24 md:w-28 items-center justify-center rounded-3xl bg-gradient-to-b from-red-500 to-red-700 shadow-xl rotate-6">
        <YoutubeIcon className="h-14 w-14 text-white" />
      </div>
      <div className="absolute left-[22%] top-[62%] flex h-24 w-24 md:h-28 md:w-28 items-center justify-center rounded-3xl bg-[linear-gradient(45deg,#f59e0b,#ef4444,#c026d3,#6366f1)] shadow-xl">
        <InstagramIcon className="h-14 w-14 text-white" />
      </div>
      <ViewBadge label="100K" className="left-[44%] top-[2%]" />
      <ViewBadge label="250K" className="left-[30%] top-[38%] hidden sm:flex" />
      <ViewBadge label="1M" className="left-[72%] top-[56%]" />
      <ViewBadge label="50K" className="left-[50%] top-[80%]" />
    </div>
  );
}
