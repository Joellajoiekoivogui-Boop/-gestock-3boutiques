import { redirect } from 'next/navigation';
import { getSession, homePathFor } from '@/lib/auth';

export default async function Home() {
  const session = await getSession();
  if (!session || !session.profile.is_active) redirect('/login');
  redirect(homePathFor(session.profile));
}
