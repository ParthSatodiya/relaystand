import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, parseId, requireItemAccess, requireStandupAccess } from '@/lib/perms';
import { logEvent } from '@/lib/audit';
import { reopenItem } from '@/lib/standup';

interface Context {
  params: Promise<{ standupId: string; itemId: string }>;
}

/** Put the finished task `itemId` back on the board for `standupId`. */
export async function POST(_req: NextRequest, context: Context) {
  try {
    const params = await context.params;
    const standupId = parseId(params.standupId, 'standup ID');
    const itemId = parseId(params.itemId, 'item ID');
    // Both ends checked: the day it lands on, and the task it came from — a
    // lead may reopen anyone's, a dev only their own.
    await requireStandupAccess(standupId);
    const { user, item, team } = await requireItemAccess(itemId);

    const back = await reopenItem(itemId, standupId);
    await logEvent({
      orgId: team.orgId,
      teamId: team.id,
      actor: { email: user.email, name: user.fullName },
      action: 'task.reopened',
      summary: `Reopened "${item.title}"`,
    });
    return NextResponse.json(back);
  } catch (e) {
    return errorResponse(e);
  }
}
