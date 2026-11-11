"use client";

import { useState } from "react";
import { DEV_DATASETS, type DevDataset, setDevDataset, useDevDataset } from "@/lib/dev-data";

const LABELS: Record<"demo" | DevDataset, string> = { demo: "Demo data", worst: "Worst case", empty: "Empty", one: "One", huge: "50 tracks" };

/**
 * DEVELOPMENT ONLY (break-ui): switches the dashboard between real data and the worst-case fixtures.
 * Collapsed to a small pill by default, so it doesn't sit on top of the page's own buttons.
 */
export function DevDataToggle() {
  const dataset = useDevDataset();
  const [open, setOpen] = useState(false);
  if (process.env.NODE_ENV === "production") return null;
  const current = dataset ?? "demo";
  const options = ["demo", ...DEV_DATASETS] as const;
  const pill = (active: boolean) => ({
    border: 0,
    borderRadius: 999,
    padding: "5px 10px",
    whiteSpace: "nowrap" as const,
    cursor: "pointer",
    background: active ? "#fff" : "transparent",
    color: "#171717",
    boxShadow: active ? "0 1px 2px rgba(0,0,0,.15)" : "none",
  });
  return (
    <div
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
        opacity: open ? 1 : 0.85,
      }}
    >
      {open ? (
        <div role="radiogroup" aria-label="Dataset (development only)" style={{ display: "flex", gap: 2 }}>
          {options.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={current === o} onClick={() => setDevDataset(o === "demo" ? null : o)} style={pill(current === o)}>
              {LABELS[o]}
            </button>
          ))}
          <button type="button" aria-label="Close dataset switcher" onClick={() => setOpen(false)} style={pill(false)}>
            ×
          </button>
        </div>
      ) : (
        <button type="button" aria-label="Dataset (development only)" onClick={() => setOpen(true)} style={pill(true)}>
          Data: {LABELS[current]}
        </button>
      )}
    </div>
  );
}
