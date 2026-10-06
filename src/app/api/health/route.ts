import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * What the container's HEALTHCHECK asks. It reads a table rather than running
 * `SELECT 1`, because the failure worth catching is the app serving pages while
 * its volume is gone — SQLite answers `SELECT 1` happily from the empty file it
 * just created in its place.
 *
 * Unauthenticated on purpose, and it says nothing but yes or no.
 */
export async function GET() {
  try {
    await prisma.org.count();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
