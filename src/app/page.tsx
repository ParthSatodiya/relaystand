import { redirect } from 'next/navigation';
import { myOrgs } from '@/lib/page';
import { pageUser } from '@/lib/page';

export default async function Home() {
  const user = await pageUser();
  const orgs = await myOrgs(user.email);
  // One org is the common case — go straight in rather than via a picker.
  if (orgs.length === 1) redirect(`/orgs/${orgs[0].slug}`);
  redirect(orgs.length === 0 ? '/onboarding' : '/orgs');
}
