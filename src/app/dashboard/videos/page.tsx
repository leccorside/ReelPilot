"use client";

import { DashboardShell } from "@/components/dashboard/shell";
import { VideoGrid } from "@/components/dashboard/video-grid";

export default function VideosPage() {
  return (
    <DashboardShell crumbs={[{ label: "Dashboard", href: "/dashboard/series/" }, { label: "Videos" }]}>
      <VideoGrid />
    </DashboardShell>
  );
}
