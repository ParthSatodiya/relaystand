'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, isToday, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useRun } from '@/lib/useRun';
import { stepDay } from '@/lib/days';
import { STALLED_DAYS, ui } from '@/lib/ui';
import MemberSection, { type MemberRow } from '@/components/MemberSection';
import WeekGrid, { type Week } from '@/components/WeekGrid';
import TabMark from '@/components/TabMark';

interface BoardData {
  id: number;
  notes: string;
  members: MemberRow[];
}

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

export default function Board({
  teamId,
  teamName,
  date,
  board,
  week,
  doneLastStandup,
  me,
}: {
  teamId: number;
  teamName: string;
  date: string;
  board: BoardData | null;
  week: Week;
  doneLastStandup: Record<number, number>;
  me: { memberId: number; isLead: boolean; canWrite: boolean };
}) {
  const router = useRouter();
  const { run, error, busy } = useRun();

  const goto = (on: string) => router.push(`/teams/${teamId}?date=${on}`);
  // Arrows hop between days that actually have a standup — skips the gaps. The
  // date picker below stays a free pick, so a lead can still land on an empty
  // day to start one there.
  // The arrows walk working days — the weekend is not a place the team works,
  // unless they stood up on one. The date field is the way onto any other day.
  const shift = (dir: -1 | 1) => stepDay(date, dir, week.heldDates);
  const items = board?.members.flatMap((m) => m.items) ?? [];
  // What the tab icon says: something is blocked, or something unfinished has
  // been running long enough to count as stuck.
  const needsYou = items.some(
    (i) => i.status === 'blocked' || (i.status !== 'done' && i.daysDragging >= STALLED_DAYS),
  );
  const doneToday = items.filter((i) => i.status === 'done').length;
  const blockedToday = items.filter((i) => i.status === 'blocked').length;
  const running = items.length - doneToday - blockedToday;
  const longestRun = items
    .filter((i) => i.status !== 'done')
    .reduce((worst, i) => Math.max(worst, i.daysDragging), 0);

  return (
    <div className="space-y-5">
      <TabMark alert={needsYou} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-dim">{teamName}</p>
          <h1 className={`${ui.h1} mt-0.5`}>{format(parseISO(date), 'EEEE d MMMM')}</h1>
        </div>

        {/* The day you are on, and the days either side that actually held one. */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => goto(shift(-1))}
            aria-label="Previous working day"
            className={`${ui.btn} ${ui.btnGhost} px-2.5`}
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            aria-label="Standup date"
            value={date}
            onChange={(e) => e.target.value && goto(e.target.value)}
            className={ui.input}
          />
          <button
            onClick={() => goto(shift(1))}
            disabled={date >= todayStr()}
            aria-label="Next working day"
            className={`${ui.btn} ${ui.btnGhost} px-2.5 disabled:opacity-30`}
          >
            <ChevronRight size={16} />
          </button>
          {!isToday(parseISO(date)) && (
            <button onClick={() => goto(todayStr())} className={`${ui.btn} ${ui.btnSubtle}`}>
              Today
            </button>
          )}
        </div>
      </div>

      {/* The day in four numbers, before any of the detail. */}
      {board && (
        <dl className="grid grid-cols-2 border-y border-line sm:grid-cols-4">
          {[
            { label: 'Running', value: running, tone: '' },
            { label: 'Finished today', value: doneToday, tone: 'text-baton' },
            {
              label: 'Blocked',
              value: blockedToday,
              tone: blockedToday ? 'text-stall' : '',
            },
            {
              label: 'Longest run',
              value: longestRun ? `${longestRun}d` : '—',
              tone: longestRun >= STALLED_DAYS ? 'text-stall' : '',
            },
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
      )}

      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}

      {/* The desk view: the working week as lanes. Below md it would be five
          unreadable columns, so the phone gets the day's list instead. */}
      <section className="hidden md:block">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2.5">
          <h2 className={ui.h2}>The week</h2>
          <p className="text-xs text-dim">
            Bar length is days running · click a person or a task to open run mode
          </p>
        </div>
        <WeekGrid
          teamId={teamId}
          week={week}
          today={date}
          standupId={board?.id ?? null}
          editable={me.canWrite}
          busy={busy}
          run={run}
        />
      </section>

      {!board && (
        <p className="text-sm text-dim md:hidden">
          No standup on this day yet. Starting one copies every unfinished task from the last
          standup you held — even if that was several days ago.
        </p>
      )}

      {!board && me.canWrite && (
        <button
          disabled={busy}
          onClick={() =>
            run(() =>
              api(`/api/teams/${teamId}/standups`, {
                method: 'POST',
                body: JSON.stringify({ date }),
              }),
            )
          }
          className={`${ui.btn} ${ui.btnPrimary} md:hidden`}
        >
          <Plus size={16} /> Start standup
        </button>
      )}

      {board && (
        <>
          <Notes key={board.id} standupId={board.id} initial={board.notes} editable={me.canWrite} />

          {/* One person to the next is the strongest boundary on this screen,
              so it gets the most space: 8 + 32 + 12 = 52px, against the 24px
              between two of one person's tasks. Under space-y-4 it was 36px —
              only 1.5x — and the split was carried by line weight instead. */}
          <div className="space-y-8 md:hidden">
            {board.members.map((member) => (
              <MemberSection
                key={member.memberId}
                teamId={teamId}
                date={date}
                member={member}
                roster={board.members.filter((m) => m.isActive)}
                standupId={board.id}
                editable={me.canWrite && (me.isLead || me.memberId === member.memberId)}
                busy={busy}
                run={run}
                doneLastStandup={doneLastStandup[member.memberId] ?? 0}
              />
            ))}
            {board.members.length === 0 && (
              <p className={`${ui.empty} text-sm text-dim`}>
                No members yet.{' '}
                <Link href={`/teams/${teamId}/members`} className="text-baton hover:underline">
                  Add your people
                </Link>{' '}
                from your organisation.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Saves on blur — no save button to hunt for, no autosave chatter. */
function Notes({
  standupId,
  initial,
  editable,
}: {
  standupId: number;
  initial: string;
  editable: boolean;
}) {
  const [notes, setNotes] = useState(initial);
  const [dirty, setDirty] = useState(false);
  // Same path as every other mutation: a failed save says so and stays dirty,
  // so the text is never dropped on the floor with a hint claiming it saved.
  const { run, error } = useRun();

  return (
    <div className={`${ui.card} p-4`}>
      <label htmlFor="standup-notes" className={ui.label}>
        Standup notes
      </label>
      <textarea
        id="standup-notes"
        value={notes}
        rows={2}
        readOnly={!editable}
        onChange={(e) => {
          setNotes(e.target.value);
          setDirty(true);
        }}
        onBlur={() => {
          if (!dirty) return;
          run(async () => {
            await api(`/api/standups/${standupId}`, {
              method: 'PUT',
              body: JSON.stringify({ notes }),
            });
            setDirty(false);
          });
        }}
        placeholder="Releases, announcements, anything the whole team needs…"
        className={`${ui.input} mt-1.5 w-full resize-y`}
      />
      {error ? (
        <p role="alert" className={`${ui.error} mt-1.5`}>
          {error}
        </p>
      ) : (
        dirty && <p className="mt-1 text-xs text-dim">Saves when you leave this field.</p>
      )}
    </div>
  );
}
