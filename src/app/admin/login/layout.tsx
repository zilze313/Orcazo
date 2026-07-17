// Server-side gate for /admin/login: an admin with a valid session has no
// business on the login screen — bounce them straight to the dashboard.
// Also serves the admin PWA manifest so installs from this page open /admin.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  manifest: "/admin-manifest.json",
};

export default async function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (session) redirect("/admin");
  return <>{children}</>;
}
