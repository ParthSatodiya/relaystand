import { demoMode } from '@/lib/signup';

/**
 * What the server checks about its own configuration before it serves anything.
 *
 * The point is the *moment*, not the cleverness. Every one of these already
 * fails today — just later, somewhere else, wearing a stack trace that does not
 * name the variable. A missing AUTH_SECRET surfaces as a broken sign-in; an
 * unset DATABASE_URL surfaces as an app that works fine and has no data in it.
 *
 * ponytail: a function returning two string arrays. No schema library, no
 * types generated from a spec — there are five rules and they are all here.
 */
export function checkEnv() {
  const fatal: string[] = [];
  const warn: string[] = [];
  const set = (name: string) => Boolean(process.env[name]?.trim());

  const production = process.env.NODE_ENV === 'production';
  const hasProvider = set('AUTH_GOOGLE_ID') || set('AUTH_MICROSOFT_ENTRA_ID_ID');

  // Signs the session cookies. Auth.js throws on the first request without it,
  // so in production this is worth refusing to start over.
  if (!set('AUTH_SECRET')) {
    (production ? fatal : warn).push(
      'AUTH_SECRET is not set. Generate one with `npx auth secret`, or ' +
        '`openssl rand -base64 32`.'
    );
  }

  // The fallback in src/lib/db.ts is a RELATIVE path, resolved from the working
  // directory by the Prisma 7 driver adapter. Unset, the server does not fail —
  // it opens a different, probably empty, database depending on where it was
  // started from. Silence is the whole problem.
  if (!set('DATABASE_URL')) {
    warn.push(
      'DATABASE_URL is not set — falling back to file:./prisma/dev.db, resolved ' +
        'from the working directory, which may not be the database you mean.'
    );
  }

  if (!hasProvider && !demoMode()) {
    warn.push(
      'No sign-in provider is configured. Set AUTH_GOOGLE_ID or ' +
        'AUTH_MICROSOFT_ENTRA_ID_ID, or run `npm run demo`. Until then nobody ' +
        'can sign in, and /login says so.'
    );
  }

  if (production && !set('AUTH_URL')) {
    warn.push(
      'AUTH_URL is not set. Behind a reverse proxy Auth.js will infer it from ' +
        'the forwarded headers; set it explicitly if sign-in redirects somewhere odd.'
    );
  }

  // Not a crash — a slow data loss. The default sits inside the container.
  if (production && !set('UPLOAD_DIR')) {
    warn.push(
      'UPLOAD_DIR is not set — uploads go to <cwd>/data/uploads, inside the ' +
        'container, and vanish on the next rebuild. Point it at the volume.'
    );
  }

  return { fatal, warn };
}
