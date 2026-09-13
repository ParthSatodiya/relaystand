import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Plus } from 'lucide-react';
import { myOrgsToday, myPendingOrgs, pageUser } from '@/lib/page';
import { today } from '@/lib/standup';
import AppHeader from '@/components/AppHeader';
import OrgMark from '@/components/OrgMark';
import { storage } from '@/lib/storage';
import { ui } from '@/lib/ui';

export default async function OrgsPage() {
  const user = await pageUser();
  const [orgs, pending] = await Promise.all([
    myOrgsToday(user.email, today()),
    myPendingOrgs(user.email),
  ]);

  // Org names are free text and only the handle is unique, so two of yours can
  // read the same. Show the handle on the ones that would otherwise be twins.
  const seen = new Map<string, number>();
  for (const o of [...orgs, ...pending]) seen.set(o.name, (seen.get(o.name) ?? 0) + 1);
  const twin = (name: string) => (seen.get(name) ?? 0) > 1;

  return (
    <>
      <AppHeader email={user.email} />
      <main id="main" className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className={ui.h1}>
              Your <span className="text-baton">organisations</span>
            </h1>
            <p className="mt-2 max-w-[52ch] text-sm text-dim">
              Pick where today&apos;s standup lives. The lanes show which of your teams have already
              held theirs.
            </p>
          </div>
          <Link href="/onboarding" className={`${ui.btn} ${ui.btnGhost}`}>
            <Plus size={16} /> Create or join
          </Link>
        </div>

        {orgs.length > 0 && (
          <div className="mt-7 border-t border-line">
            {orgs.map((org) => (
              <Link
                key={org.id}
                href={`/orgs/${org.slug}`}
                className="group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border-b border-line-soft py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-baton sm:grid-cols-[auto_minmax(0,1fr)_auto]"
              >
                <OrgMark org={org} size={12} url={org.logoPath ? storage().url(org.logoPath) : undefined} />

                <div className="min-w-0">
                  <h2 className="display truncate text-xl group-hover:text-baton sm:text-2xl">
                    {org.name}
                  </h2>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-dim">
                    <span className="text-chalk">{org.myRole === 'admin' ? 'Admin' : 'Member'}</span>
                    <span>
                      {org.teamCount} {org.teamCount === 1 ? 'team' : 'teams'} of yours
                    </span>
                    {twin(org.name) && <span className="font-mono text-xs">{org.slug}</span>}
                  </p>
                </div>

                {/* One pip a team: filled when that team has held today. */}
                <div className="col-span-2 sm:col-span-1 sm:justify-self-end sm:text-right">
                  {org.teamCount > 0 ? (
                    <>
                      <div aria-hidden="true" className="flex flex-wrap gap-1 sm:justify-end">
                        {Array.from({ length: org.teamCount }).map((_, i) => (
                          <span
                            key={i}
                            className={`h-2 w-7 rounded-full ${
                              i < org.blockedCount
                                ? 'hatch'
                                : i < org.heldCount
                                  ? 'bg-baton'
                                  : 'bg-chalk/12'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-dim tabular-nums">
                        {org.blockedCount > 0 && (
                          <span className="text-stall">{org.blockedCount} blocked · </span>
                        )}
                        {org.heldCount} of {org.teamCount} held standup
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-dim">You are not on a team here yet</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {pending.length > 0 && (
          <section className="mt-8">
            <h2 className={ui.h2}>Waiting on an admin</h2>
            <ul className="mt-3 border-t border-line-soft">
              {pending.map((org) => (
                <li
                  key={org.id}
                  className="flex flex-wrap items-center gap-3 border-b border-line-soft py-3.5 text-sm"
                >
                  <OrgMark org={org} url={org.logoPath ? storage().url(org.logoPath) : undefined} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{org.name}</span>
                    <span className="block truncate text-xs text-dim">
                      <span className="font-mono">{org.slug}</span>
                      {orgs.some((mine) => mine.name === org.name) &&
                        ' · a different org from the one of yours with this name'}
                    </span>
                  </span>
                  <span className="text-dim tabular-nums">
                    Asked {format(parseISO(org.askedAt), 'd MMM')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {orgs.length === 0 && pending.length === 0 && (
          <div className={`${ui.empty} mt-7`}>
            <p className="font-medium">No organisation yet</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-dim">
              Create one for your company and add your team, or ask to join one a colleague already
              runs.
            </p>
            <Link href="/onboarding" className={`${ui.btn} ${ui.btnPrimary} mt-5`}>
              Get started
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
