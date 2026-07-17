// Layout for authenticated admin pages. /admin/login is in a different segment
// so it bypasses this entirely.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/session';
import { ensureAdminBootstrap } from '@/lib/admin-bootstrap';
import { AdminShell } from '@/components/admin-shell';
import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  // Admin-specific manifest: installing the PWA from an admin page must open
  // /admin, not the creator app (whose manifest starts at /campaigns).
  manifest: '/admin-manifest.json',
};

export default async function AdminAuthedLayout({ children }: { children: React.ReactNode }) {
  await ensureAdminBootstrap();
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');

  return (
    <>
      <ServiceWorkerRegistrar />
      <AdminShell email={session.email} role={session.role} permissions={session.permissions}>
        {children}
      </AdminShell>
    </>
  );
}
