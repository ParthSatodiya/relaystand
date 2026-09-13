import { notFound } from 'next/navigation';
import { pageOrg } from '@/lib/page';
import { orgPeople } from '@/lib/orgs';
import AppHeader from '@/components/AppHeader';
import OrgPeople from './OrgPeople';

export default async function OrgPeoplePage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await pageOrg((await params).slug);
  if (!ctx) notFound();

  const people = await orgPeople(ctx.org.id);
  return (
    <>
      <AppHeader email={ctx.user.email} org={ctx.org} isAdmin={ctx.isAdmin} />
      <main id="main" className="mx-auto max-w-4xl px-4 py-6">
        <OrgPeople
          slug={ctx.org.slug}
          orgName={ctx.org.name}
          isAdmin={ctx.isAdmin}
          myEmail={ctx.user.email}
          people={people}
        />
      </main>
    </>
  );
}
