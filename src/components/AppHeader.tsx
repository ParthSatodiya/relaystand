import Link from 'next/link';
import { ChevronDown, Plus } from 'lucide-react';
import { signOut } from '@/auth';
import { myOrgs, myTeams } from '@/lib/page';
import OrgMark from '@/components/OrgMark';
import { storage } from '@/lib/storage';

interface OrgLike {
  id: number;
  name: string;
  slug: string;
  logoPath: string;
}

/**
 * One header for every screen. The org switcher is a native <details>, so it
 * opens, closes and takes keyboard focus without a line of client JavaScript.
 */
export default async function AppHeader({
  email,
  org,
  isAdmin = false,
  team,
}: {
  email: string;
  org?: OrgLike;
  isAdmin?: boolean;
  /** Set on team pages — turns the trail into a switcher. */
  team?: { id: number; name: string };
}) {
  const orgs = org ? await myOrgs(email) : [];
  // A lead on two teams switches here rather than walking back to the org page.
  // An admin may be looking at a team they are not on, so the open one is added
  // to their own list when it is missing.
  const teams = org && team ? await myTeams(email, org.id) : [];
  const switchable = teams.some((t) => t.id === team?.id)
    ? teams
    : team
      ? [...teams, { id: team.id, name: team.name, role: '' }]
      : [];

  return (
    <header className="relative border-b border-line bg-raised">
      {/* Up to eight links here and four more in the team tabs, on every page.
          The first Tab should be able to jump the lot. */}
      <a
        href="#main"
        className="sr-only rounded bg-baton text-sm font-semibold text-baton-ink focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <Link href="/orgs" className="display shrink-0 text-lg">
          Relay<span className="text-baton">Stand</span>
        </Link>

        {org && (
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-chalk/8">
              <OrgMark org={org} size={5} url={org.logoPath ? storage().url(org.logoPath) : undefined} />
              <span className="max-w-40 truncate font-medium">{org.name}</span>
              <ChevronDown size={14} className="text-dim transition group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 z-10 mt-1 w-64 rounded-md border border-line bg-raised p-1 shadow-[0_14px_34px_rgba(0,0,0,.45)]">
              {orgs.map((o) => (
                <Link
                  key={o.id}
                  href={`/orgs/${o.slug}`}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-chalk/5 ${
                    o.id === org.id ? 'font-medium' : ''
                  }`}
                >
                  <OrgMark org={o} size={5} url={o.logoPath ? storage().url(o.logoPath) : undefined} />
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                  {o.myRole === 'admin' && <span className="text-xs text-dim">admin</span>}
                </Link>
              ))}
              <div className="my-1 border-t border-line-soft" />
              {isAdmin && (
                <>
                  <Link
                    href={`/orgs/${org.slug}/members`}
                    className="block rounded-md px-2 py-1.5 text-sm hover:bg-chalk/5"
                  >
                    People and requests
                  </Link>
                  <Link
                    href={`/orgs/${org.slug}/settings`}
                    className="block rounded-md px-2 py-1.5 text-sm hover:bg-chalk/5"
                  >
                    Organisation settings
                  </Link>
                </>
              )}
              <Link
                href={`/orgs/${org.slug}/audit`}
                className="block rounded-md px-2 py-1.5 text-sm hover:bg-chalk/5"
              >
                Audit log
              </Link>
              <Link
                href="/onboarding"
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-chalk/5"
              >
                <Plus size={14} /> Create or join another
              </Link>
            </div>
          </details>
        )}

        {team && org && (
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-chalk/8">
              <span aria-hidden="true" className="text-dim">
                /
              </span>
              <span className="max-w-48 truncate font-medium">{team.name}</span>
              <ChevronDown size={14} className="text-dim transition group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 z-10 mt-1 w-60 rounded-md border border-line bg-raised p-1 shadow-[0_14px_34px_rgba(0,0,0,.45)]">
              {switchable.map((t) => (
                <Link
                  key={t.id}
                  href={`/teams/${t.id}`}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-chalk/5 ${
                    t.id === team.id ? 'font-medium' : ''
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  {t.role === 'lead' && <span className="text-xs text-dim">lead</span>}
                </Link>
              ))}
              <div className="my-1 border-t border-line-soft" />
              <Link
                href={`/orgs/${org.slug}`}
                className="block rounded-md px-2 py-1.5 text-sm text-dim hover:bg-chalk/5"
              >
                All teams in {org.name}
              </Link>
            </div>
          </details>
        )}

        <div className="ml-auto flex min-w-0 items-center gap-3 text-sm">
          <span className="hidden truncate text-dim sm:block" title={email}>
            {email}
          </span>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button className="shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-dim transition hover:bg-chalk/8">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
