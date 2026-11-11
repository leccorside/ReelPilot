import { LogoMark } from "./icons";
import { BRAND } from "@/lib/brand";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-heading text-xl font-extrabold flex items-center gap-2 ${className}`}>
      <LogoMark className="w-6 h-6 text-primary" />
      {BRAND}
    </span>
  );
}
