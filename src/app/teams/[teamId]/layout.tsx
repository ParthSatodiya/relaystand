import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { pageMembership } from '@/lib/page';
import { today } from '@/lib/standup';
import AppHeader from '@/components/AppHeader';
import TeamNav from '@/components/TeamNav';

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ teamId: string }>;
}) {
  const teamId = Number((await params).teamId);
  const ctx = await pageMembership(teamId);
  if (!ctx) {
    // Not a member — the page itself renders the friendly refusal, but it still
    // needs a header, and the org name is not ours to show.
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) notFound();
    const { pageUser } = await import('@/lib/page');
    const user = await pageUser();
    return (
      <>
        <AppHeader email={user.email} />
        <main id="main" className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </>
    );
  }

  // Counts for the tab row: today's board and the roster. Two cheap reads, so
  // the header can be scanned without opening anything.
  const [standup, memberCount] = await Promise.all([
    prisma.standup.findUnique({
      where: { teamId_date: { teamId, date: today() } },
      select: { items: { select: { status: true } } },
    }),
    prisma.teamMember.count({ where: { teamId, isActive: true } }),
  ]);

  return (
    <>
      <AppHeader
        email={ctx.user.email}
        org={ctx.org}
        isAdmin={ctx.isAdmin}
        team={{ id: teamId, name: ctx.team.name }}
      />
      <TeamNav
        teamId={teamId}
        taskCount={standup ? standup.items.length : null}
        memberCount={memberCount}
        blocked={!!standup?.items.some((i) => i.status === 'blocked')}
      />
      <main id="main" className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
