import { redirect } from 'next/navigation';
import { getEmployeeSession } from '@/lib/session';
import { AuthScreen } from './_auth-screen';

export const dynamic = 'force-dynamic';

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getEmployeeSession();
  if (session) redirect('/campaigns');

  const { tab } = await searchParams;
  const defaultTab = tab === 'signup' ? 'signup' : 'login';

  return <AuthScreen defaultTab={defaultTab} />;
}
