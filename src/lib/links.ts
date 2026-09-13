import { HttpError } from '@/lib/http';

/**
 * Pure link helpers — no Prisma import, so client components can pull from here
 * without dragging the database client into the browser bundle.
 */

/** A stored link row, trimmed to what the client renders. */
export interface LinkRow {
  url: string;
}

export interface TaskLink {
  url: string;
  label: string;
  kind: 'jira' | 'github' | 'other';
}

/**
 * The chip a link renders as. The provider is read off the URL — PROJ-1234 for
 * a Jira ticket, repo#482 for a PR — so a new tracker needs no schema change.
 * Anything that is not http(s) is dropped rather than rendered as a link.
 */
export function taskLink(raw: string): TaskLink | null {
  const url = raw.trim();
  if (!/^https?:\/\//i.test(url)) return null;

  let host: string;
  let path: string;
  try {
    const parsed = new URL(url);
    host = parsed.hostname.replace(/^www\./, '');
    path = parsed.pathname;
  } catch {
    return null;
  }

  if (host === 'github.com') {
    const pr = path.match(/^\/[^/]+\/([^/]+)\/(?:pull|issues)\/(\d+)/);
    return { url, label: pr ? `${pr[1]}#${pr[2]}` : 'github', kind: 'github' };
  }

  const jira = url.match(/([A-Z][A-Z0-9]+-\d+)/);
  if (jira) return { url, label: jira[1], kind: 'jira' };

  return { url, label: host, kind: 'other' };
}

/** Capped so one task cannot carry a wall of links. */
export const MAX_LINKS = 8;

/**
 * Trust boundary: only http(s) URLs ever reach the database or an href. A bad
 * one is refused rather than dropped — silently swallowing a pasted link looks
 * to the user like the save worked.
 */
export function cleanLinks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  // Blank rows are just the editor's empty slots, so those go quietly.
  const urls = value.map((v) => String(v).trim()).filter((v) => v.length > 0);

  const bad = urls.find((v) => v.length > 500 || !/^https?:\/\//i.test(v));
  if (bad) throw new HttpError(400, `Links must be http:// or https:// URLs — got "${bad.slice(0, 60)}"`);
  if (urls.length > MAX_LINKS) throw new HttpError(400, `A task can hold at most ${MAX_LINKS} links`);

  return urls;
}
