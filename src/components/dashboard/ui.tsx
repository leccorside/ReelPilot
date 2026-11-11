"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { buttonClass } from "../button";

export function Card({ children, className = "", ...rest }: React.HTMLAttributes<HTMLDivElement> & { "data-testid"?: string }) {
  return (
    <div className={`rounded-xl border bg-card text-card-foreground shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 p-6 pb-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

const BADGE: Record<string, string> = {
  primary: "bg-primary/10 border-primary/30 text-primary",
  green: "bg-green-50 border-green-200 text-green-700",
  amber: "bg-amber-50 border-amber-200 text-amber-700",
  gray: "bg-muted border-border text-muted-foreground",
  blue: "bg-blue-50 border-blue-200 text-blue-700",
  red: "bg-red-50 border-red-200 text-red-700",
};

export function Badge({ children, tone = "primary", className = "" }: { children: React.ReactNode; tone?: keyof typeof BADGE; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${BADGE[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-input"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-background shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div role="dialog" aria-label={title} className={`relative w-full ${wide ? "max-w-2xl" : "max-w-lg"} rounded-lg border bg-background p-6 shadow-lg`}>
        <button className="absolute right-4 top-4 opacity-70 hover:opacity-100" aria-label="Close" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
        <div className="space-y-1.5 mb-4 pr-6">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <button className={buttonClass("outline")} onClick={onClose}>
            Cancel
          </button>
          <button
            className={buttonClass("primary", "default", danger ? "bg-destructive hover:bg-destructive/90" : "")}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDone, 3000);
    return () => window.clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[80] rounded-md border bg-background px-4 py-3 text-sm shadow-lg" role="status">
      {message}
    </div>
  );
}

export const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
