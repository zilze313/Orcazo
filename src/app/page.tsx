import { redirect } from 'next/navigation';
import { getEmployeeSession } from '@/lib/session';
import { BrandHomepage } from './_marketing/brand-homepage';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Logged-in creators get sent straight to their dashboard.
  const session = await getEmployeeSession();
  if (session) redirect('/campaigns');

  return <BrandHomepage />;
}
