import { redirect } from 'next/navigation';
import { getEmployeeSession } from '@/lib/session';
import { db } from '@/lib/db';
import { CreatorShell } from '@/components/creator-shell';

export const dynamic = 'force-dynamic';

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const session = await getEmployeeSession();
  if (!session) redirect('/login');

  const employee = await db.employee.findUnique({
    where: { id: session.employeeId },
    select: { email: true, firstName: true },
  });
  if (!employee) redirect('/login');

  return <CreatorShell user={employee}>{children}</CreatorShell>;
}
