'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import type { LinkRow } from '@/lib/links';
import { daysTone, pill, STALLED_DAYS, statusLabel, statusPill, ui } from '@/lib/ui';
import LinkChips from '@/components/LinkChips';

interface SummaryRow {
  memberId: number;
  memberName: string;
  isActive: boolean;
  completed: number;
  stillOpen: number;
  blocked: number;
  absentDays: number;
  avgDaysToDone: number | null;
  longestDragging: number;
}

interface DraggingRow {
  id: number;
  title: string;
  status: string;
  links: LinkRow[];
  memberName: string;
  days: number;
}

interface HistoryDay {
  date: string;
  absent: boolean;
  items: {
    id: number;
    title: string;
    status: string;
    links: LinkRow[];
    carried: boolean;
    days: number;
  }[];
}

interface ReportData {
  from: string;
  to: string;
  standupCount: number;
  latestDate: string | null;
  summary: SummaryRow[];
  dragging: DraggingRow[];
  history: { memberId: number; memberName: string; days: HistoryDay[] } | null;
  members: { id: number; name: string; isActive: boolean }[];
}

const fmt = (d: string) => format(parseISO(d), 'd MMM');

export default function Reports({
  teamId,
  teamName,
  data,
}: {
  teamId: number;
  teamName: string;
  data: ReportData;
}) {
  const router = useRouter();
  const search = useSearchParams();

  // Range and selected person live in the URL, so the server re-renders and
  // the view is shareable — no client fetching, no loading spinner.
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(search.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/teams/${teamId}/reports?${next}`);
  }

  const totals = data.summary.reduce(
    (acc, r) => ({
      completed: acc.completed + r.completed,
      stillOpen: acc.stillOpen + r.stillOpen,
      blocked: acc.blocked + r.blocked,
    }),
    { completed: 0, stillOpen: 0, blocked: 0 }
  );
  // Bar length is the person's workload, so a quiet week does not look like a busy one.
  const busiest = Math.max(
    1,
    ...data.summary.map((r) => r.completed + r.stillOpen + r.blocked)
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/teams/${teamId}`} className="text-sm text-dim hover:text-baton">
            ← {teamName}
          </Link>
          <h1 className={`${ui.h1} mt-1`}>
            Reports{' '}
            <span className="text-baton">
              {fmt(data.from)}–{fmt(data.to)}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="report-from" className={ui.label}>
              From
            </label>
            <input
              id="report-from"
              type="date"
              value={data.from}
              onChange={(e) => e.target.value && setParam('from', e.target.value)}
              className={`${ui.input} mt-1 block`}
            />
          </div>
          <div>
            <label htmlFor="report-to" className={ui.label}>
              To
            </label>
            <input
              id="report-to"
              type="date"
              value={data.to}
              onChange={(e) => e.target.value && setParam('to', e.target.value)}
              className={`${ui.input} mt-1 block`}
            />
          </div>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 border-y border-line sm:grid-cols-4">
        {[
          { label: 'Standups held', value: data.standupCount, tone: '' },
          { label: 'Finished', value: totals.completed, tone: 'text-baton' },
          { label: 'Still running', value: totals.stillOpen, tone: '' },
          { label: 'Blocked', value: totals.blocked, tone: totals.blocked ? 'text-stall' : '' },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`px-4 py-3.5 ${i > 0 ? 'border-l border-line-soft' : ''} ${
              i === 2 ? 'border-l-0 sm:border-l' : ''
            }`}
          >
            <dt className={ui.label}>{stat.label}</dt>
            <dd className={`display mt-1 text-3xl tabular-nums ${stat.tone}`}>{stat.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 max-w-[72ch] text-xs leading-relaxed text-dim">
        Finished counts every task closed in this range. Still running and blocked are the position
        at the last standup
        {data.latestDate ? ` (${fmt(data.latestDate)})` : ''} — so a task that dragged five days is
        counted once, not five times.
      </p>

      <section className="mt-9">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2.5">
          <h2 className={ui.h2}>Per person</h2>
          <p className="text-xs text-dim">
            Bar length is their workload; fill is finished, running, blocked
          </p>
        </div>

        {data.summary.length === 0 ? (
          <p className="py-8 text-center text-sm text-dim">No standups in this range.</p>
        ) : (
          data.summary.map((row) => {
            const total = row.completed + row.stillOpen + row.blocked;
            return (
              <div
                key={row.memberId}
                className="grid items-center gap-x-5 gap-y-2.5 border-b border-line-soft py-4 md:grid-cols-[170px_minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.memberName}</p>
                  {!row.isActive && (
                    <p className="text-[11px] uppercase tracking-[0.12em] text-dim">removed</p>
                  )}
                </div>

                <div className="min-w-0">
                  <div
                    className="flex h-4 overflow-hidden rounded-full bg-chalk/8"
                    style={{ width: `${Math.max(6, (total / busiest) * 100)}%` }}
                  >
                    {row.completed > 0 && (
                      <span className="bg-baton" style={{ flex: row.completed }} />
                    )}
                    {row.stillOpen > 0 && (
                      <span className="bg-chalk/30" style={{ flex: row.stillOpen }} />
                    )}
                    {row.blocked > 0 && <span className="hatch" style={{ flex: row.blocked }} />}
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-dim tabular-nums">
                  <span>
                    finished <b className="font-semibold text-chalk">{row.completed}</b>
                  </span>
                  <span>
                    avg <b className="font-semibold text-chalk">{row.avgDaysToDone ?? '—'}</b>
                  </span>
                  <span>
                    longest{' '}
                    <b className={`font-semibold ${daysTone(row.longestDragging)}`}>
                      {row.longestDragging ? `${row.longestDragging}d` : '—'}
                    </b>
                  </span>
                  <span>
                    away <b className="font-semibold text-chalk">{row.absentDays || '—'}</b>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </section>

      {data.dragging.length > 0 && (
        <section className="mt-9">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2.5">
            <h2 className={ui.h2}>Still running, oldest first</h2>
            <p className="text-xs text-dim">Days since the task first appeared</p>
          </div>
          {data.dragging.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-4 border-b border-line-soft py-3"
            >
              <p
                className={`display text-right text-2xl leading-none tabular-nums ${
                  item.days >= STALLED_DAYS ? 'text-stall' : ''
                }`}
              >
                {item.days}
                <span className="block font-sans text-[10px] tracking-[0.12em] text-dim">DAYS</span>
              </p>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">{item.title}</span>
                  <LinkChips links={item.links} />
                </div>
                <p className="mt-0.5 text-xs text-dim">{item.memberName}</p>
              </div>
              <span className={`${pill} ${statusPill[item.status]}`}>{statusLabel[item.status]}</span>
            </div>
          ))}
        </section>
      )}

      <section className="mt-9">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2.5">
          <h2 className={ui.h2}>One person, day by day</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="report-member" className={ui.label}>
              Person
            </label>
            <select
              id="report-member"
              value={data.history?.memberId ?? ''}
              onChange={(e) => setParam('memberId', e.target.value)}
              className={`${ui.input} py-1.5`}
            >
              <option value="">Pick someone…</option>
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!data.history ? (
          <p className="py-8 text-center text-sm text-dim">
            Pick someone to see what they finished each day.
          </p>
        ) : data.history.days.length === 0 ? (
          <p className="py-8 text-center text-sm text-dim">No standups in this range.</p>
        ) : (
          data.history.days.map((day) => (
            <div
              key={day.date}
              className="grid grid-cols-[78px_minmax(0,1fr)] items-start gap-4 border-b border-line-soft py-3.5"
            >
              <div className="tabular-nums">
                <p className="font-semibold">{fmt(day.date)}</p>
                <p className="text-xs text-dim">
                  {day.absent
                    ? 'away'
                    : `${day.items.filter((i) => i.status === 'done').length} of ${day.items.length} done`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {day.items.map((item) => (
                  <span
                    key={item.id}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                      item.status === 'done'
                        ? 'border-baton bg-baton text-baton-ink'
                        : item.status === 'blocked'
                          ? 'hatch border-stall'
                          : 'border-line'
                    }`}
                  >
                    {item.title}
                    <LinkChips links={item.links} />
                    {item.carried && (
                      <small
                        className={`text-xs tabular-nums ${
                          item.status === 'done' ? 'text-baton-ink/65' : 'text-dim'
                        }`}
                      >
                        carried {item.days}d
                      </small>
                    )}
                  </span>
                ))}
                {day.items.length === 0 && !day.absent && (
                  <span className="text-sm text-dim">No tasks.</span>
                )}
                {day.absent && (
                  <span className="text-[11px] uppercase tracking-[0.12em] text-dim">On leave</span>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
