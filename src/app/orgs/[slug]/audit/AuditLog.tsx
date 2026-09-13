'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ui } from '@/lib/ui';

interface Event {
  id: number;
  action: string;
  label: string;
  summary: string;
  actorName: string;
  actorEmail: string;
  teamName: string;
  at: string;
}

export default function AuditLog({
  slug,
  scope,
  from,
  to,
  teams,
  events,
  capped,
  actions,
}: {
  slug: string;
  scope: 'org' | 'teams';
  from: string;
  to: string;
  teams: { id: number; name: string }[];
  events: Event[];
  capped: boolean;
  // Handed down rather than imported: @/lib/audit talks to Prisma, and this is
  // a client component.
  actions: Record<string, string>;
}) {
  const router = useRouter();
  const search = useSearchParams();

  // Filters live in the URL, like the reports range — the view is shareable and
  // the server does the filtering.
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(search.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/orgs/${slug}/audit?${next}`);
  }

  return (
    <div>
      <div>
        <h1 className={ui.h1}>Audit log</h1>
        <p className="mt-2 max-w-[60ch] text-sm text-dim">
          {scope === 'org'
            ? 'Every change to this organisation, its people and its teams.'
            : 'Changes to the teams you lead.'}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3 border-b border-line pb-5">
        <div>
          <label htmlFor="audit-action" className={ui.label}>
            Event
          </label>
          <select
            id="audit-action"
            value={search.get('action') ?? ''}
            onChange={(e) => setParam('action', e.target.value)}
            className={`${ui.input} mt-1 block`}
          >
            <option value="">All events</option>
            {Object.entries(actions).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {teams.length > 0 && (
          <div>
            <label htmlFor="audit-team" className={ui.label}>
              Team
            </label>
            <select
              id="audit-team"
              value={search.get('teamId') ?? ''}
              onChange={(e) => setParam('teamId', e.target.value)}
              className={`${ui.input} mt-1 block`}
            >
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="audit-from" className={ui.label}>
            From
          </label>
          <input
            id="audit-from"
            type="date"
            value={from}
            onChange={(e) => e.target.value && setParam('from', e.target.value)}
            className={`${ui.input} mt-1 block`}
          />
        </div>
        <div>
          <label htmlFor="audit-to" className={ui.label}>
            To
          </label>
          <input
            id="audit-to"
            type="date"
            value={to}
            onChange={(e) => e.target.value && setParam('to', e.target.value)}
            className={`${ui.input} mt-1 block`}
          />
        </div>
      </div>

      {capped && (
        <p className="mt-3 text-xs text-dim">
          Showing the most recent 200 events in this range. Narrow the dates to see older ones.
        </p>
      )}

      <ul className="mt-5">
        {events.map((event, i) => {
          const day = format(parseISO(event.at), 'EEEE d MMMM');
          const newDay = i === 0 || day !== format(parseISO(events[i - 1].at), 'EEEE d MMMM');
          return (
            <li key={event.id}>
              {newDay && (
                <p className={`${ui.h2} border-b border-line pb-2.5 ${i > 0 ? 'mt-8' : ''}`}>
                  {day}
                </p>
              )}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-soft py-3">
                <time
                  dateTime={event.at}
                  className="w-12 shrink-0 text-xs text-dim tabular-nums"
                  title={format(parseISO(event.at), 'PPpp')}
                >
                  {format(parseISO(event.at), 'HH:mm')}
                </time>
                <span className="basis-full text-sm sm:basis-auto sm:flex-1">
                  {event.summary}
                  {event.teamName && <span className="text-dim"> · {event.teamName}</span>}
                </span>
                <span className="text-xs text-dim" title={event.actorEmail}>
                  {event.actorName}
                </span>
              </div>
            </li>
          );
        })}
        {events.length === 0 && (
          <li className="py-10 text-center text-sm text-dim">Nothing recorded in this range.</li>
        )}
      </ul>
    </div>
  );
}
