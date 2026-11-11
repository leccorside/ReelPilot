// Drawn stand-ins for the original's photos and video frames: gradient scenes with simple
// silhouettes and the bold caption word that faceless reels show on screen.

const PALETTES = [
  ["#1e1b4b", "#7c3aed", "#f0abfc"],
  ["#3f1d0b", "#b45309", "#fde68a"],
  ["#0c4a6e", "#0ea5e9", "#bae6fd"],
  ["#1c1917", "#78350f", "#f97316"],
  ["#14532d", "#65a30d", "#d9f99d"],
  ["#312e81", "#6366f1", "#c7d2fe"],
  ["#450a0a", "#b91c1c", "#fca5a5"],
  ["#0f172a", "#334155", "#94a3b8"],
];

export function Scene({
  variant = 0,
  word,
  className = "",
  wordClass = "text-lg",
}: {
  variant?: number;
  word?: string;
  className?: string;
  wordClass?: string;
}) {
  const [a, b, c] = PALETTES[variant % PALETTES.length];
  const kind = variant % 4;
  return (
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? "" : "relative"} overflow-hidden ${className}`} style={{ background: `linear-gradient(180deg, ${c} 0%, ${b} 45%, ${a} 100%)` }}>
      <svg viewBox="0 0 90 160" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <circle cx={kind % 2 ? 68 : 22} cy={kind === 2 ? 40 : 28} r={kind === 3 ? 10 : 14} fill="#fff" opacity="0.35" />
        {kind === 0 && <path d="M0 120 L20 90 L35 110 L55 70 L75 105 L90 85 L90 160 L0 160Z" fill={a} opacity="0.85" />}
        {kind === 1 && <path d="M10 160 L10 70 Q10 50 30 50 L60 50 Q80 50 80 70 L80 160Z" fill={a} opacity="0.75" />}
        {kind === 2 && <path d="M0 130 Q45 95 90 130 L90 160 L0 160Z" fill={a} opacity="0.85" />}
        {kind === 3 && <path d="M0 110 L90 110 L90 160 L0 160Z" fill={a} opacity="0.8" />}
        <g fill={a} opacity="0.95">
          <circle cx="45" cy="78" r="9" />
          <path d="M31 160 L33 102 Q35 90 45 90 Q55 90 57 102 L59 160Z" />
        </g>
      </svg>
      {word && (
        <span className={`caption-word absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 uppercase tracking-tight ${wordClass}`}>
          {word}
        </span>
      )}
    </div>
  );
}

const AVATAR_COLORS = ["#7c3aed", "#0ea5e9", "#f97316", "#16a34a", "#e11d48", "#0f766e", "#a16207", "#4f46e5"];

/** A round portrait placeholder: a simple head-and-shoulders silhouette on a colour. */
export function Portrait({ index = 0, className = "" }: { index?: number; className?: string }) {
  const bg = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <span className={`relative flex shrink-0 overflow-hidden rounded-full ${className}`} style={{ background: `linear-gradient(160deg, ${bg}55, ${bg})` }}>
      <svg viewBox="0 0 40 40" className="h-full w-full">
        <circle cx="20" cy="16" r="7" fill="#fff" opacity="0.9" />
        <path d="M6 40 Q8 26 20 26 Q32 26 34 40Z" fill="#fff" opacity="0.9" />
      </svg>
    </span>
  );
}

export function Avatar({ name, index = 0, className = "" }: { name: string; index?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white text-xs font-semibold ${className}`}
      style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
      aria-label={name}
    >
      {initials}
    </span>
  );
}
