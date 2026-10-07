import { pageMembership } from '@/lib/page';
import { dateParam, doneCountsBefore, loadBoard, loadWeek, standupDays, today } from '@/lib/standup';
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
  const [board, week, days, doneLastStandup] = await Promise.all([
    loadBoard(teamId, date),
    // The five working days ending on the day being viewed — the desk view.
    loadWeek(teamId, date),
    // Dots for the day picker: which days this team has stood up on.
    standupDays(teamId),
    // Counts only — the titles live on the walkthrough.
    doneCountsBefore(teamId, date),
  ]);

  return (
    <Board
      teamId={teamId}
      date={date}
      // Derived here, not in the browser: a standup day is the team's day, and
      // the team's day is whatever the server's TZ says. A viewer in another
      // zone must not see a different "today" from the one the API will write.
      today={today()}
      board={board}
      week={week}
      days={days}
      doneLastStandup={doneLastStandup}
      me={{ memberId: ctx.member?.id ?? 0, isLead: ctx.isLead, canWrite: ctx.canWrite }}
    />
  );
}
