import { addDays, format } from 'date-fns';
import { pageMembership } from '@/lib/page';
import { buildReport } from '@/lib/reports';
import { dateParam, today } from '@/lib/standup';
import NoAccess from '@/components/NoAccess';
import Reports from './Reports';

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ from?: string; to?: string; memberId?: string }>;
}) {
  const teamId = Number((await params).teamId);
  const ctx = await pageMembership(teamId);
  if (!ctx) return <NoAccess />;

  const q = await searchParams;
  const from = dateParam(q.from, format(addDays(new Date(), -13), 'yyyy-MM-dd'));
  const to = dateParam(q.to, today());
  const memberId = q.memberId ? Number(q.memberId) : null;

  const data = await buildReport(teamId, from, to, Number.isNaN(memberId) ? null : memberId);

  return <Reports teamId={teamId} teamName={ctx.team.name} data={data} />;
}
