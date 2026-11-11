import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND} | AI Faceless Reels Generator on Auto-Pilot`,
  description: "Create faceless reels on autopilot. AI generates and posts faceless videos to TikTok, Instagram & YouTube while you sleep.",
};

export const viewport: Viewport = { themeColor: "#6d0ef1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background">{children}</body>
    </html>
  );
}
