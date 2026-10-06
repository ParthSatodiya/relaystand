import prisma from '@/lib/db';

/**
 * Everything one organisation owns, as plain JSON. The point is that leaving is
 * possible: a self-hoster who wants out gets the whole record, not a summary.
 *
 * ponytail: one nested read rather than a query a table. The tree IS the
 * document, and an org is a few thousand rows at most.
 */
export async function buildOrgExport(orgId: number) {
  const org = await prisma.org.findUniqueOrThrow({
    where: { id: orgId },
    include: {
      members: { orderBy: { id: 'asc' } },
      events: { orderBy: { id: 'asc' } },
      teams: {
        orderBy: { id: 'asc' },
        include: {
          members: { orderBy: { id: 'asc' } },
          standups: {
            orderBy: { date: 'asc' },
            include: {
              items: { orderBy: { id: 'asc' }, include: { links: { orderBy: { id: 'asc' } } } },
              absences: { orderBy: { id: 'asc' } },
            },
          },
        },
      },
    },
  });
  // logoPath names a file under UPLOAD_DIR, which is not in here. Back the
  // volume up for that; see scripts/backup.mjs.
  return { exportedAt: new Date().toISOString(), org };
}
