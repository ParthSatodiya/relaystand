import { notFound, redirect } from 'next/navigation';
import { pageOrg } from '@/lib/page';
import { storage } from '@/lib/storage';
import AppHeader from '@/components/AppHeader';
import OrgSettings from './OrgSettings';

export default async function OrgSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await pageOrg(slug);
  if (!ctx) notFound();
  if (!ctx.isAdmin) redirect(`/orgs/${slug}`);

  return (
    <>
      <AppHeader email={ctx.user.email} org={ctx.org} isAdmin={ctx.isAdmin} />
      <main id="main" className="mx-auto max-w-xl px-4 py-6">
        <OrgSettings
          slug={ctx.org.slug}
          name={ctx.org.name}
          emailDomain={ctx.org.emailDomain}
          logoUrl={ctx.org.logoPath ? storage().url(ctx.org.logoPath) : ''}
        />
      </main>
    </>
  );
}
