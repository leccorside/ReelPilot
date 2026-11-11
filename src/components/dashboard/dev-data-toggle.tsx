"use client";

import { DEV_DATASETS, type DevDataset, setDevDataset, useDevDataset } from "@/lib/dev-data";

const LABELS: Record<"demo" | DevDataset, string> = { demo: "Demo data", worst: "Worst case", empty: "Empty", one: "One", huge: "50 tracks" };

/** DEVELOPMENT ONLY (break-ui): switches the dashboard between real data and the worst-case fixtures. */
export function DevDataToggle() {
  const dataset = useDevDataset();
  if (process.env.NODE_ENV === "production") return null;
  const options = ["demo", ...DEV_DATASETS] as const;
  return (
    <div
      role="radiogroup"
      aria-label="Dataset (development only)"
      data-dev-toggle
      style={{
        position: "fixed",
        left: "50%",
        bottom: 84,
        transform: "translateX(-50%)",
        zIndex: 90,
        display: "flex",
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: "#e5e5e5",
        font: "12px system-ui, sans-serif",
        boxShadow: "0 1px 4px rgba(0,0,0,.15)",
        maxWidth: "calc(100vw - 16px)",
        overflowX: "auto",
      }}
    >
      {options.map((o) => {
        const active = (dataset ?? "demo") === o;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setDevDataset(o === "demo" ? null : o)}
            style={{
              border: 0,
              borderRadius: 999,
              padding: "5px 10px",
              whiteSpace: "nowrap",
              cursor: "pointer",
              background: active ? "#fff" : "transparent",
              color: "#171717",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,.15)" : "none",
            }}
          >
            {LABELS[o]}
          </button>
        );
      })}
    </div>
  );
}
