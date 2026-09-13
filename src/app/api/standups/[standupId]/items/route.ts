import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { errorResponse, HttpError, parseId, requireStandupAccess } from '@/lib/perms';
import { isStatus } from '@/lib/standup';
import { cleanLinks } from '@/lib/links';

interface Context {
  params: Promise<{ standupId: string }>;
}

export async function POST(req: NextRequest, context: Context) {
  try {
    const standupId = parseId((await context.params).standupId, 'standup ID');
    const { standup, member, isLead } = await requireStandupAccess(standupId);

    const { memberId, title, links, comment, status } = await req.json();
    const targetId = Number(memberId);
    if (!targetId) throw new HttpError(400, 'memberId is required');
    if (!String(title ?? '').trim()) throw new HttpError(400, 'title is required');
    if (status !== undefined && !isStatus(status)) throw new HttpError(400, 'Invalid status');
    if (!isLead && targetId !== member?.id) {
      throw new HttpError(403, 'You can only add items for yourself');
    }

    const target = await prisma.teamMember.findFirst({
      where: { id: targetId, teamId: standup.teamId },
    });
    if (!target) throw new HttpError(404, 'That member is not on this team');

    const last = await prisma.standupItem.findFirst({
      where: { standupId, memberId: targetId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });

    return NextResponse.json(
      await prisma.standupItem.create({
        data: {
          standupId,
          memberId: targetId,
          title: String(title).trim(),
          comment: String(comment ?? '').trim(),
          status: status ?? 'open',
          originDate: standup.date,
          displayOrder: last ? last.displayOrder + 1 : 0,
          links: { create: cleanLinks(links).map((url) => ({ url })) },
        },
        include: { links: true },
      })
    );
  } catch (e) {
    return errorResponse(e);
  }
}

/** Batch reorder after a drag: { order: [itemId, ...] } for one member's list. */
export async function PATCH(req: NextRequest, context: Context) {
  try {
    const standupId = parseId((await context.params).standupId, 'standup ID');
    const { member, isLead } = await requireStandupAccess(standupId);

    const { order } = await req.json();
    if (!Array.isArray(order) || order.some((id) => !Number.isInteger(id))) {
      throw new HttpError(400, 'order must be an array of item IDs');
    }

    const items = await prisma.standupItem.findMany({
      where: { id: { in: order as number[] }, standupId },
    });
    if (items.length !== order.length) {
      throw new HttpError(404, 'Some items do not belong to this standup');
    }
    if (!isLead && items.some((i) => i.memberId !== member?.id)) {
      throw new HttpError(403, 'You can only reorder your own items');
    }

    await prisma.$transaction(
      (order as number[]).map((id, index) =>
        prisma.standupItem.update({ where: { id }, data: { displayOrder: index } })
      )
    );
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
