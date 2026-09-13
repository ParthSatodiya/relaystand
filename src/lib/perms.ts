import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { HttpError } from '@/lib/http';
import { orgMembershipOf, teamContext } from '@/lib/access';

export { HttpError };
export { teamContext } from '@/lib/access';

/** The logged-in User row, or 401. */
export async function requireUser() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) throw new HttpError(401, 'Unauthorized');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw new HttpError(401, 'Unauthorized');
  return user;
}

export async function requireOrg(slugOrId: string | number) {
  const user = await requireUser();
  const org =
    typeof slugOrId === 'number'
      ? await prisma.org.findUnique({ where: { id: slugOrId } })
      : await prisma.org.findUnique({ where: { slug: slugOrId } });
  if (!org) throw new HttpError(404, 'Organisation not found');

  const orgMember = await orgMembershipOf(user.email, org.id);
  return { user, org, orgMember, isAdmin: orgMember.role === 'admin' };
}

export async function requireOrgAdmin(slugOrId: string | number) {
  const ctx = await requireOrg(slugOrId);
  if (!ctx.isAdmin) throw new HttpError(403, 'Only an organisation admin can do this');
  return ctx;
}

export async function requireMembership(teamId: number) {
  const user = await requireUser();
  return { user, ...(await teamContext(user.email, teamId)) };
}

export async function requireLead(teamId: number) {
  const ctx = await requireMembership(teamId);
  if (!ctx.isLead) throw new HttpError(403, 'Only a team lead can do this');
  return ctx;
}

/**
 * Standup-level access (notes, items, absences, deleting a day). Every caller
 * is a mutation, so the observer check lives here rather than in each route.
 */
export async function requireStandupAccess(standupId: number) {
  const user = await requireUser();
  const standup = await prisma.standup.findUnique({ where: { id: standupId } });
  if (!standup) throw new HttpError(404, 'Standup not found');

  const ctx = await teamContext(user.email, standup.teamId);
  if (!ctx.canWrite) throw new HttpError(403, 'Observers can only read this board');
  return { user, standup, ...ctx };
}

/** Leads and org admins may touch any item on the team; everyone else only their own. */
export async function requireItemAccess(itemId: number) {
  const user = await requireUser();
  const item = await prisma.standupItem.findUnique({
    where: { id: itemId },
    include: { standup: true },
  });
  if (!item) throw new HttpError(404, 'Item not found');

  const ctx = await teamContext(user.email, item.standup.teamId);
  if (!ctx.canWrite) throw new HttpError(403, 'Observers can only read this board');
  if (!ctx.isLead && item.memberId !== ctx.member?.id) {
    throw new HttpError(403, 'You can only change your own items');
  }
  return { user, item, ...ctx };
}

export function parseId(value: string, what: string) {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new HttpError(400, `Invalid ${what}`);
  return id;
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
