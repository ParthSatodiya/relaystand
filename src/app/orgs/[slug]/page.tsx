import { notFound } from 'next/navigation';
import { pageOrg } from '@/lib/page';
import { listTeams } from '@/lib/reports';
import { today } from '@/lib/standup';
import AppHeader from '@/components/AppHeader';
import TeamList from './TeamList';

export default async function OrgHome({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await pageOrg((await params).slug);
  if (!ctx) notFound();

  const todayStr = today();
  const teams = await listTeams(ctx.user.email, todayStr, ctx.org.id, ctx.isAdmin);
  return (
    <>
      <AppHeader email={ctx.user.email} org={ctx.org} isAdmin={ctx.isAdmin} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <TeamList orgId={ctx.org.id} orgName={ctx.org.name} teams={teams} today={todayStr} />
      </main>
    </>
  );
}
