'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface Tab {
  href: string;
  label: string;
  count?: number;
  alert?: boolean;
}

/**
 * Row two of the header: the pages of one team, with the open one on a baton
 * underline. It never changes shape as you move around inside the team.
 */
export default function TeamNav({
  teamId,
  taskCount,
  memberCount,
  blocked,
}: {
  teamId: number;
  taskCount: number | null;
  memberCount: number;
  blocked: boolean;
}) {
  const path = usePathname();
  const search = useSearchParams();
  // Keep the day you are looking at when you step sideways into another page.
  const date = search.get('date');
  const qs = date ? `?date=${date}` : '';
  const base = `/teams/${teamId}`;

  // Run standup is an action, not a place — it lives on the board, next to the
  // day it runs. These three are the places.
  const tabs: Tab[] = [
    { href: `${base}${qs}`, label: 'Board', count: taskCount ?? undefined, alert: blocked },
    { href: `${base}/reports`, label: 'Reports' },
    { href: `${base}/members`, label: 'Members', count: memberCount },
  ];

  const current = (href: string) => {
    const clean = href.split('?')[0];
    return clean === base ? path === base : path.startsWith(clean);
  };

  return (
    <nav
      aria-label="Team"
      className="-mb-px flex gap-1 overflow-x-auto border-b border-line bg-raised px-4"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          aria-current={current(tab.href) ? 'page' : undefined}
          className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm transition ${
            current(tab.href)
              ? 'border-baton font-semibold text-chalk'
              : 'border-transparent text-dim hover:text-chalk'
          }`}
        >
          {tab.label}
          {/* A count is data about the page, not part of its name, so it gets
              its own chip. Coral when something on it is blocked. */}
          {tab.count !== undefined && (
            <span
              aria-label={tab.alert ? `${tab.count}, something blocked` : undefined}
              className={`ml-2 rounded px-1.5 py-0.5 align-middle text-[10px] tabular-nums ${
                tab.alert
                  ? 'bg-stall/15 text-stall'
                  : current(tab.href)
                    ? 'bg-baton/15 text-baton'
                    : 'bg-chalk/10 text-dim'
              }`}
            >
              {tab.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
