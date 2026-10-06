#!/usr/bin/env node
/**
 * A snapshot of the database file, taken while the app keeps serving.
 *
 * `VACUUM INTO` is SQLite's own online backup: it writes a consistent copy of
 * the whole database, WAL and all, without blocking writers and without the
 * half-written file you get from `cp`-ing a live SQLite database.
 *
 *   node scripts/backup.mjs [directory]     # default: ./backups
 *
 * ponytail: node:sqlite, not the better-sqlite3 the app runs on. Next's
 * standalone output strips that package down to its package.json, so the same
 * command has to work in the container with nothing installed. No rotation, no
 * compression, no schedule either — point cron at it.
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// In the container DATABASE_URL is already set and there is no .env to read.
try {
  process.loadEnvFile('.env');
} catch {}

const src = (process.env.DATABASE_URL ?? 'file:./prisma/dev.db').replace(/^file:/, '');
// Opening a missing file would create an empty one and back that up happily.
if (!existsSync(src)) {
  console.error(`No database at ${src}. Set DATABASE_URL to the one you mean.`);
  process.exit(1);
}

const dir = process.argv[2] ?? 'backups';
mkdirSync(dir, { recursive: true });

// UTC, so a set of backups sorts by name wherever the server thinks it is.
const stamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, '');
const out = path.resolve(dir, `relaystand-${stamp}Z.db`);

const db = new DatabaseSync(src);
// Quoted and escaped: the path comes from argv, and VACUUM INTO takes no
// bound parameters.
db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
db.close();

console.log(out);
console.log('Uploaded logos live under UPLOAD_DIR, not in here — copy that too.');
