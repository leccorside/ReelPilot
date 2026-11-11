import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";

// Every dashboard page runs with a session checked against the database (src/auth.ts).
// The provider refreshes it every 5 minutes and on window focus, which also keeps the
// 2-hour JWT alive while the dashboard is open.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login/?callbackUrl=/dashboard/series/");
  return (
    <SessionProvider session={session} refetchInterval={5 * 60} refetchOnWindowFocus>
      {children}
    </SessionProvider>
  );
}
