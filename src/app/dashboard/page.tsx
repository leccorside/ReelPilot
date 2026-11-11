import { redirect } from "next/navigation";

// With a real server the redirect happens before any HTML is sent.
export default function DashboardIndex() {
  redirect("/dashboard/series/");
}
