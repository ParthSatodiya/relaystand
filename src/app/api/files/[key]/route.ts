import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireUser } from '@/lib/perms';
import { contentTypeOf, safeKey, storage } from '@/lib/storage';

interface Context {
  params: Promise<{ key: string }>;
}

/**
 * Streams whatever the storage backend holds. A cloud backend would redirect to
 * its own URL instead; nothing that renders a file cares which happens.
 */
export async function GET(_req: NextRequest, context: Context) {
  try {
    await requireUser();
    const key = safeKey((await context.params).key);
    const data = await storage().read(key);
    if (!data) return new NextResponse(null, { status: 404 });

    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': contentTypeOf(key),
        // The key changes whenever the file does, so this can be cached hard.
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
