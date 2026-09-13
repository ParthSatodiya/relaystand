import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, parseId, requireMembership } from '@/lib/perms';
import { requireDate, startStandup, today } from '@/lib/standup';

interface Context {
  params: Promise<{ teamId: string }>;
}

/** Explicit "Start standup" — creates the day and carries unfinished work forward. */
export async function POST(req: NextRequest, context: Context) {
  try {
    const teamId = parseId((await context.params).teamId, 'team ID');
    const { user } = await requireMembership(teamId);

    const body = await req.json().catch(() => ({}));
    const date = requireDate(body.date ?? today());

    const standup = await startStandup(teamId, date, user.id);
    return NextResponse.json({ id: standup.id, date });
  } catch (e) {
    return errorResponse(e);
  }
}
