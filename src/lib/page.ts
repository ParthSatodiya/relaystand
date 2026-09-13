import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { teamContext } from '@/lib/access';

/**
 * The signed-in User row, or null. Every page asks this one question — a live
 * session cookie whose User row is gone (a reset database, a deactivated
 * account) counts as signed out, so /login and the app can never disagree and
 * bounce the browser between them.
 */
export async function currentUser() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;

  const user = await prisma.user.findUnique({ where: { email } });
  return user?.isActive ? user : null;
}

/** Page-level equivalent of requireUser(): redirect instead of a 401 body. */
export async function pageUser() {
  return (await currentUser()) ?? redirect('/login');
}

/** Every org this person can actually enter, for the switcher. */
export async function myOrgs(email: string) {
  const rows = await prisma.orgMember.findMany({
    where: { email, status: 'active' },
    include: { org: true },
    orderBy: { org: { name: 'asc' } },
  });
  return rows.map((r) => ({ ...r.org, myRole: r.role }));
}

/** Teams in this org this person is on, for the header's team switcher. */
export async function myTeams(email: string, orgId: number) {
  const rows = await prisma.teamMember.findMany({
    where: { email, isActive: true, team: { orgId } },
    include: { team: true },
    orderBy: { team: { name: 'asc' } },
  });
  return rows.map((r) => ({ id: r.team.id, name: r.team.name, role: r.role }));
}

/**
 * The org picker's rows: each org with how many of your teams there have held a
 * standup today, and whether any of them is blocked. One extra query, not one
 * per org.
 */
export async function myOrgsToday(email: string, todayStr: string) {
  const orgs = await myOrgs(email);
  if (orgs.length === 0) return [];

  const teams = await prisma.team.findMany({
    where: {
      orgId: { in: orgs.map((o) => o.id) },
      members: { some: { email, isActive: true } },
    },
    select: {
      orgId: true,
      standups: { where: { date: todayStr }, select: { items: { select: { status: true } } } },
    },
  });

  return orgs.map((org) => {
    const mine = teams.filter((t) => t.orgId === org.id);
    const held = mine.filter((t) => t.standups.length > 0);
    return {
      ...org,
      teamCount: mine.length,
      heldCount: held.length,
      blockedCount: held.filter((t) =>
        t.standups[0].items.some((i) => i.status === 'blocked')
      ).length,
    };
  });
}

/** Join requests this person has out, so onboarding can say "waiting". */
export async function myPendingOrgs(email: string) {
  const rows = await prisma.orgMember.findMany({
    where: { email, status: 'pending' },
    include: { org: true },
    orderBy: { createdAt: 'desc' },
  });
  // askedAt travels with it: two orgs can share a display name, so a request
  // needs its own marks — the handle and the day it was sent.
  return rows.map((r) => ({ ...r.org, askedAt: r.createdAt.toISOString() }));
}

/** An org by slug, or null so the page can render a friendly refusal. */
export async function pageOrg(slug: string) {
  const user = await pageUser();
  const org = await prisma.org.findUnique({ where: { slug } });
  if (!org) return null;

  const orgMember = await prisma.orgMember.findUnique({
    where: { orgId_email: { orgId: org.id, email: user.email } },
  });
  if (!orgMember || orgMember.status !== 'active') return null;
  return { user, org, orgMember, isAdmin: orgMember.role === 'admin' };
}

/** Team membership for a page, or null so the page can render a friendly refusal. */
export async function pageMembership(teamId: number) {
  const user = await pageUser();
  try {
    const ctx = await teamContext(user.email, teamId);
    return { user, ...ctx, org: await prisma.org.findUniqueOrThrow({ where: { id: ctx.team.orgId } }) };
  } catch {
    return null;
  }
}
