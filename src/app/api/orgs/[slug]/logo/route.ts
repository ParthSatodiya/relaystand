import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logEvent } from '@/lib/audit';
import { errorResponse, HttpError, requireOrgAdmin } from '@/lib/perms';
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, storage } from '@/lib/storage';

interface Context {
  params: Promise<{ slug: string }>;
}

export async function POST(req: NextRequest, context: Context) {
  try {
    const { slug } = await context.params;
    const { user, org } = await requireOrgAdmin(slug);

    const form = await req.formData();
    const file = form.get('logo');
    if (!(file instanceof File)) throw new HttpError(400, 'Choose an image to upload');

    const ext = ALLOWED_IMAGE_TYPES[file.type];
    if (!ext) throw new HttpError(400, 'Use a PNG, JPEG or WebP image');
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new HttpError(400, `That image is over ${Math.round(MAX_UPLOAD_BYTES / 1024)} KB`);
    }

    const store = storage();
    // New key each time, so a replaced logo is never served from a cache.
    const key = `org-${org.id}-${Date.now().toString(36)}.${ext}`;
    await store.save(key, Buffer.from(await file.arrayBuffer()));
    if (org.logoPath) await store.delete(org.logoPath);

    await prisma.org.update({ where: { id: org.id }, data: { logoPath: key } });
    await logEvent({
      orgId: org.id,
      actor: { email: user.email, name: user.fullName },
      action: 'org.updated',
      summary: `Changed the ${org.name} logo`,
    });

    return NextResponse.json({ logoUrl: store.url(key) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, context: Context) {
  try {
    const { slug } = await context.params;
    const { user, org } = await requireOrgAdmin(slug);
    if (org.logoPath) await storage().delete(org.logoPath);
    await prisma.org.update({ where: { id: org.id }, data: { logoPath: '' } });
    await logEvent({
      orgId: org.id,
      actor: { email: user.email, name: user.fullName },
      action: 'org.updated',
      summary: `Removed the ${org.name} logo`,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
