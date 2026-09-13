import prisma from '@/lib/db';
import { HttpError } from '@/lib/http';

/** URL-safe name, uniquified against the orgs that already exist. */
export async function uniqueSlug(name: string) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'org';

  for (let n = 0; ; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`;
    if (!(await prisma.org.findUnique({ where: { slug } }))) return slug;
  }
}

export function normaliseDomain(value: unknown) {
  const domain = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '');
  if (!domain) return '';
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    throw new HttpError(400, 'Enter a domain like acme.com, or leave it blank');
  }
  return domain;
}

export const domainOf = (email: string) => email.split('@')[1] ?? '';

/** The people page: everyone in the org, requests first. */
export async function orgPeople(orgId: number) {
  const members = await prisma.orgMember.findMany({
    where: { orgId },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  });
  return {
    pending: members.filter((m) => m.status === 'pending'),
    active: members.filter((m) => m.status === 'active'),
    deactivated: members.filter((m) => m.status === 'deactivated'),
  };
}

/** Orgs a signed-out-of-everything user could ask to join, by email domain. */
export async function orgsForDomain(email: string, exclude: number[]) {
  const domain = domainOf(email);
  if (!domain) return [];
  return prisma.org.findMany({
    where: { emailDomain: domain, id: { notIn: exclude } },
    select: { id: true, name: true, slug: true, logoPath: true },
  });
}

/** Refuse to leave an org with nobody to run it. */
export async function assertNotLastAdmin(orgId: number, memberId: number) {
  const member = await prisma.orgMember.findUnique({ where: { id: memberId } });
  if (!member || member.role !== 'admin' || member.status !== 'active') return;
  const admins = await prisma.orgMember.count({
    where: { orgId, role: 'admin', status: 'active' },
  });
  if (admins <= 1) {
    throw new HttpError(409, 'Make someone else an admin first — an org needs one');
  }
}
