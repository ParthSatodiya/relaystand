import { pageMembership } from '@/lib/page';
import { dateParam, loadBoard, previousCompleted } from '@/lib/standup';
import NoAccess from '@/components/NoAccess';
import Walkthrough from './Walkthrough';

export default async function WalkthroughPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ date?: string; member?: string }>;
}) {
  const teamId = Number((await params).teamId);
  const ctx = await pageMembership(teamId);
  if (!ctx) return <NoAccess />;

  const q = await searchParams;
  const date = dateParam(q.date);
  const asked = q.member ? Number(q.member) : null;
  const startMemberId = asked !== null && !Number.isNaN(asked) ? asked : null;

  const [board, completed] = await Promise.all([
    loadBoard(teamId, date),
    previousCompleted(teamId, date),
  ]);

  return (
    // Re-key so arriving from someone's card starts the walkthrough on them.
    <Walkthrough
      key={`${date}:${startMemberId ?? ''}`}
      teamId={teamId}
      date={date}
      board={board}
      completed={completed}
      startMemberId={startMemberId}
      me={{ memberId: ctx.member?.id ?? 0, isLead: ctx.isLead }}
    />
  );
}
