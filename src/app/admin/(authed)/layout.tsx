// Layout for authenticated admin pages. /admin/login is in a different segment
// so it bypasses this entirely.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/session';
import { AdminShell } from '@/components/admin-shell';
import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  manifest: '/manifest.json',
};

export default async function AdminAuthedLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');

  return (
    <>
      <ServiceWorkerRegistrar />
      <AdminShell email={session.email}>{children}</AdminShell>
    </>
  );
}
