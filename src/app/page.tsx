import { redirect } from 'next/navigation';
import { getEmployeeSession } from '@/lib/session';
import { CreatorHomepage } from './_marketing/creator-homepage';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getEmployeeSession();
  if (session) redirect('/campaigns');

  return <CreatorHomepage />;
}
