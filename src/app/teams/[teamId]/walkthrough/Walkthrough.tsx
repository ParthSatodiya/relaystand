'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Check, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useRun } from '@/lib/useRun';
import type { LinkRow } from '@/lib/links';
import { daysTone, initials, ui } from '@/lib/ui';
import LinkChips from '@/components/LinkChips';

interface Item {
  id: number;
  title: string;
  links: LinkRow[];
  comment: string;
  status: string;
  carriedFromId: number | null;
  daysDragging: number;
}

interface MemberRow {
  memberId: number;
  memberName: string;
  role: string;
  isAbsent: boolean;
  items: Item[];
}

interface BoardData {
  id: number;
  members: MemberRow[];
}

interface Done {
  id: number;
  memberId: number;
  title: string;
  links: LinkRow[];
}

interface Completed {
  date: string;
  items: Done[];
}

/** Minutes and seconds since this page opened — a standup that runs long says so. */
function Elapsed() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  return (
    <span className="tabular-nums">
      <b className="display text-lg">{`${mm}:${ss}`}</b> elapsed
    </span>
  );
}

/**
 * One person at a time, sized to be read off a shared screen: what they
 * finished last standup, then what they signed up for today.
 */
export default function Walkthrough({
  teamId,
  date,
  board,
  completed,
  startMemberId,
  me,
}: {
  teamId: number;
  date: string;
  board: BoardData | null;
  completed: Completed | null;
  startMemberId: number | null;
  me: { memberId: number; isLead: boolean };
}) {
  const members = board?.members ?? [];
  const { run, error, busy } = useRun();
  const [at, setAt] = useState(() =>
    Math.max(0, members.findIndex((m) => m.memberId === startMemberId))
  );

  const step = useCallback(
    (dir: -1 | 1) => setAt((i) => Math.min(Math.max(i + dir, 0), members.length - 1)),
    [members.length]
  );

  // Arrow keys, because this gets driven from across the room.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  if (!board || members.length === 0) {
    return (
      <div className={ui.empty}>
        <p className="font-medium">
          {board ? 'No members on this team yet' : 'No standup on this day yet'}
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-dim">
          {board
            ? 'Add people from your organisation, then walk the team through the day here.'
            : 'Start the standup on the board, then walk the team through it here.'}
        </p>
        <Link href={`/teams/${teamId}?date=${date}`} className={`${ui.btn} ${ui.btnPrimary} mt-5`}>
          Back to the board
        </Link>
      </div>
    );
  }

  const member = members[at];
  const yesterday = completed?.items.filter((i) => i.memberId === member.memberId) ?? [];
  const doneToday = member.items.filter((i) => i.status === 'done').length;
  // Same rule as the board: a lead may reopen anyone's task, a dev only their own.
  const editable = me.isLead || me.memberId === member.memberId;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-3">
        <h1 className={ui.h2}>Run standup</h1>
        <p className="text-sm text-dim">{format(parseISO(date), 'EEE d MMM')}</p>
        <p className="hidden text-xs text-dim sm:block">
          <kbd className="rounded border border-line border-b-2 px-1.5 py-0.5">←</kbd>{' '}
          <kbd className="rounded border border-line border-b-2 px-1.5 py-0.5">→</kbd> to move
        </p>

        <div className="ml-auto flex items-center gap-3 text-sm text-dim">
          <span className="tabular-nums">
            {at + 1} of {members.length}
          </span>
          <Elapsed />
          <span className="flex items-center gap-1.5">
            <button
              onClick={() => step(-1)}
              disabled={at === 0}
              aria-label="Previous person"
              className={`${ui.btn} ${ui.btnGhost} px-2 disabled:opacity-30`}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => step(1)}
              disabled={at >= members.length - 1}
              aria-label="Next person"
              className={`${ui.btn} ${ui.btnGhost} px-2 disabled:opacity-30`}
            >
              <ChevronRight size={16} />
            </button>
            <Link
              href={`/teams/${teamId}?date=${date}`}
              aria-label="Close run mode"
              className={`${ui.btn} ${ui.btnDanger} px-2`}
            >
              <X size={16} />
            </Link>
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className={`${ui.error} mt-4`}>
          {error}
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-5 border-b border-line pb-5">
        <span
          aria-hidden="true"
          className="display grid size-16 shrink-0 place-items-center rounded bg-baton text-2xl text-baton-ink"
        >
          {initials(member.memberName)}
        </span>
        <div className="min-w-0">
          <h2 className="display text-3xl sm:text-4xl">{member.memberName}</h2>
          <p className="mt-1.5 flex flex-wrap gap-x-4 text-xs uppercase tracking-[0.12em] text-dim">
            <span>{member.role === 'lead' ? 'Lead' : 'Dev'}</span>
            {member.isAbsent && <span className="text-warn">On leave</span>}
            {member.items.some((i) => i.carriedFromId !== null) && (
              <span>
                longest run{' '}
                <b
                  className={`font-semibold ${daysTone(
                    Math.max(...member.items.map((i) => i.daysDragging))
                  )}`}
                >
                  {Math.max(...member.items.map((i) => i.daysDragging))}d
                </b>
              </span>
            )}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="display text-4xl tabular-nums">
            {doneToday}/{member.items.length}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-dim">done today</p>
        </div>
      </div>

      <div className="mt-7 grid gap-9 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <section>
          <h3 className={`${ui.h2} border-b border-line-soft pb-2.5`}>
            Finished {completed ? format(parseISO(completed.date), 'EEEE') : 'last standup'}
          </h3>
          {yesterday.length === 0 ? (
            <p className="mt-3 text-[15px] text-dim">Nothing finished.</p>
          ) : (
            <ul className="mt-1">
              {yesterday.map((item) => {
                const backOnToday = member.items.some((i) => i.carriedFromId === item.id);
                return (
                  <li key={item.id} className="flex items-start gap-3 py-2.5">
                    <Check size={17} className="mt-1 shrink-0 text-baton" />
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] leading-relaxed">{item.title}</span>
                      <LinkChips links={item.links} />
                      {backOnToday ? (
                        <span className="text-xs text-dim">Back on today&apos;s plan</span>
                      ) : (
                        editable && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(() =>
                                api(`/api/standups/${board.id}/items/${item.id}/reopen`, {
                                  method: 'POST',
                                })
                              )
                            }
                            title="Put this task back on today's plan"
                            className={`${ui.btn} ${ui.btnSubtle} px-2 py-0.5 text-xs`}
                          >
                            <RotateCcw size={12} /> Put back on today
                          </button>
                        )
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-2.5">
            <h3 className={ui.h2}>Today</h3>
            <p className="text-xs text-dim tabular-nums">
              {member.items.length} {member.items.length === 1 ? 'task' : 'tasks'}
            </p>
          </div>
          {member.items.length === 0 ? (
            <p className="mt-3 text-[15px] text-dim">
              {member.isAbsent ? 'On leave.' : 'No tasks yet.'}
            </p>
          ) : (
            <ul>
              {member.items.map((item) => (
                <li key={item.id} className="border-b border-line-soft py-3.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`text-lg leading-snug ${
                        item.status === 'done' ? 'text-dim line-through decoration-baton' : ''
                      }`}
                    >
                      {item.title}
                    </span>
                    <LinkChips links={item.links} />
                    {item.carriedFromId !== null && (
                      <span className={`text-xs tabular-nums ${daysTone(item.daysDragging)}`}>
                        carried {item.daysDragging}d
                      </span>
                    )}
                    <span
                      className={`ml-auto text-xs uppercase tracking-[0.09em] ${
                        item.status === 'done'
                          ? 'text-baton'
                          : item.status === 'blocked'
                            ? 'text-stall'
                            : 'text-dim'
                      }`}
                    >
                      {item.status === 'open' ? 'running' : item.status}
                    </span>
                  </div>
                  {item.comment && (
                    <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-dim">
                      {item.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* One lane a person: filled once you have been through them. */}
      <div className="mt-9 flex flex-wrap justify-center gap-4 border-t border-line pt-5">
        {members.map((m, i) => (
          <button
            key={m.memberId}
            onClick={() => setAt(i)}
            aria-current={i === at}
            className="flex flex-col items-center gap-1.5 text-xs"
          >
            <span
              className={`block h-1.5 w-9 rounded-full ${
                m.isAbsent
                  ? 'bg-chalk/12'
                  : i === at
                    ? 'bg-baton'
                    : i < at
                      ? 'bg-baton/45'
                      : 'bg-chalk/15'
              }`}
            />
            <span className={i === at ? 'text-chalk' : 'text-dim'}>
              {m.memberName.split(' ')[0]}
              {m.isAbsent && ' · away'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
