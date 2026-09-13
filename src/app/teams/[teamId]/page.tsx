import { pageMembership } from '@/lib/page';
import { dateParam, doneCountsBefore, loadBoard, loadWeek, neighbourDates } from '@/lib/standup';
import NoAccess from '@/components/NoAccess';
import Board from './Board';

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const teamId = Number((await params).teamId);
  const ctx = await pageMembership(teamId);
  if (!ctx) return <NoAccess />;

  const date = dateParam((await searchParams).date);
  const [board, week, neighbours, doneLastStandup] = await Promise.all([
    loadBoard(teamId, date),
    // The five working days ending on the day being viewed — the desk view.
    loadWeek(teamId, date),
    neighbourDates(teamId, date),
    // Counts only — the titles live on the walkthrough.
    doneCountsBefore(teamId, date),
  ]);

  return (
    <Board
      teamId={teamId}
      teamName={ctx.team.name}
      date={date}
      board={board}
      week={week}
      neighbours={neighbours}
      doneLastStandup={doneLastStandup}
      me={{ memberId: ctx.member?.id ?? 0, isLead: ctx.isLead, canWrite: ctx.canWrite }}
    />
  );
}
