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

  const tabs: Tab[] = [
    { href: `${base}${qs}`, label: 'Board', count: taskCount ?? undefined, alert: blocked },
    { href: `${base}/reports`, label: 'Reports' },
    { href: `${base}/members`, label: 'Members', count: memberCount },
    { href: `${base}/walkthrough${qs}`, label: 'Run standup' },
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
          {tab.count !== undefined && (
            <span
              className={`ml-1.5 text-xs tabular-nums ${
                current(tab.href) ? 'text-baton' : 'text-dim'
              }`}
            >
              {tab.count}
            </span>
          )}
          {tab.alert && (
            <span
              aria-label="something is blocked"
              role="img"
              className="ml-1.5 inline-block size-1.5 rounded-full bg-stall align-middle"
            />
          )}
        </Link>
      ))}
    </nav>
  );
}
