'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, isToday, parseISO } from 'date-fns';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  GripVertical,
  OctagonAlert,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useRun } from '@/lib/useRun';
import { MAX_LINKS, type LinkRow } from '@/lib/links';
import { daysTone, initials, laneWidth, pill, STALLED_DAYS, statusPill, ui } from '@/lib/ui';
import LinkChips from '@/components/LinkChips';
import TabMark from '@/components/TabMark';

export interface Item {
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
  isActive: boolean;
  isAbsent: boolean;
  items: Item[];
}

interface BoardData {
  id: number;
  notes: string;
  members: MemberRow[];
}

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

const STATUS_OPTIONS = [
  { value: 'open', label: 'Running', Icon: Circle },
  { value: 'done', label: 'Finished', Icon: Check },
  { value: 'blocked', label: 'Blocked', Icon: OctagonAlert },
] as const;

export default function Board({
  teamId,
  teamName,
  date,
  board,
  neighbours,
  doneLastStandup,
  me,
}: {
  teamId: number;
  teamName: string;
  date: string;
  board: BoardData | null;
  neighbours: { prev: string | null; next: string | null };
  doneLastStandup: Record<number, number>;
  me: { memberId: number; isLead: boolean; canWrite: boolean };
}) {
  const router = useRouter();
  const { run, error, busy } = useRun();

  const goto = (on: string) => router.push(`/teams/${teamId}?date=${on}`);
  // Arrows hop between days that actually have a standup — skips the gaps. The
  // date picker below stays a free pick, so a lead can still land on an empty
  // day to start one there.
  const { prev: prevDate, next: nextDate } = neighbours;
  const items = board?.members.flatMap((m) => m.items) ?? [];
  // What the tab icon says: something is blocked, or something unfinished has
  // been running long enough to count as stuck.
  const needsYou = items.some(
    (i) => i.status === 'blocked' || (i.status !== 'done' && i.daysDragging >= STALLED_DAYS)
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
            onClick={() => prevDate && goto(prevDate)}
            disabled={!prevDate}
            aria-label="Previous standup"
            className={`${ui.btn} ${ui.btnGhost} px-2.5 disabled:opacity-30`}
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
            onClick={() => nextDate && goto(nextDate)}
            disabled={!nextDate}
            aria-label="Next standup"
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
            { label: 'Blocked', value: blockedToday, tone: blockedToday ? 'text-stall' : '' },
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

      {!board && (
        <div className={ui.empty}>
          <p className="font-medium">No standup on this day yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-dim">
            Starting it copies every unfinished task from the last standup you held — even if that
            was several days ago.
          </p>
          <button
            disabled={busy || !me.canWrite}
            onClick={() =>
              run(() =>
                api(`/api/teams/${teamId}/standups`, {
                  method: 'POST',
                  body: JSON.stringify({ date }),
                })
              )
            }
            className={`${ui.btn} ${ui.btnPrimary} mt-5`}
          >
            <Plus size={16} /> Start standup
          </button>
        </div>
      )}

      {board && (
        <>
          <Notes
            key={board.id}
            standupId={board.id}
            initial={board.notes}
            editable={me.canWrite}
          />

          <div className="space-y-4">
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

function MemberSection({
  teamId,
  date,
  member,
  roster,
  standupId,
  editable,
  busy,
  run,
  doneLastStandup,
}: {
  teamId: number;
  date: string;
  member: MemberRow;
  roster: MemberRow[];
  standupId: number;
  editable: boolean;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  doneLastStandup: number;
}) {
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);

  // ponytail: native HTML5 drag events, no library. No touch support — swap in
  // @dnd-kit if the team ever runs standup from a phone. Move up/down below
  // covers the keyboard path onto the same endpoint.
  const reorder = (ids: number[]) =>
    run(() =>
      api(`/api/standups/${standupId}/items`, {
        method: 'PATCH',
        body: JSON.stringify({ order: ids }),
      })
    );

  function drop(targetId: number) {
    setOverId(null);
    if (dragId === null || dragId === targetId) return setDragId(null);

    const ids = member.items.map((i) => i.id);
    ids.splice(ids.indexOf(targetId), 0, ids.splice(ids.indexOf(dragId), 1)[0]);
    setDragId(null);
    reorder(ids);
  }

  function move(itemId: number, dir: -1 | 1) {
    const ids = member.items.map((i) => i.id);
    const from = ids.indexOf(itemId);
    const to = from + dir;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    reorder(ids);
  }

  const done = member.items.filter((i) => i.status === 'done').length;
  const carried = member.items.filter((i) => i.carriedFromId !== null).length;

  return (
    <section className="border-b border-line pb-2">
      <header className="flex flex-wrap items-center justify-between gap-2 py-3">
        {/* The identity block is the link, not the whole card — the rest of the
            card is buttons, inputs and drag targets. */}
        <Link
          href={`/teams/${teamId}/walkthrough?date=${date}&member=${member.memberId}`}
          aria-label={`Walk through ${member.memberName}'s day`}
          className="group flex items-center gap-2.5 rounded-lg"
        >
          <span
            aria-hidden="true"
            className="display grid size-9 place-items-center rounded bg-chalk/12 text-sm text-dim"
          >
            {initials(member.memberName)}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-medium leading-tight group-hover:underline">
                {member.memberName}
              </h2>
              {member.role === 'lead' && (
                <span className="rounded-full bg-chalk/10 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-chalk">
                  lead
                </span>
              )}
              {!member.isActive && (
                <span className="rounded-full bg-chalk/10 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-dim">
                  removed
                </span>
              )}
              {member.isAbsent && (
                <span className="rounded-full bg-warn/15 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-warn">
                  on leave
                </span>
              )}
            </div>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-dim tabular-nums">
              <span>
                {done} of {member.items.length} done
              </span>
              {carried > 0 && <span className="text-warn">{carried} carried</span>}
              {doneLastStandup > 0 && (
                <span className="text-baton">{doneLastStandup} finished last standup</span>
              )}
            </p>
          </div>
        </Link>

        {editable && (
          <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-dim">
            <input
              type="checkbox"
              checked={member.isAbsent}
              className="accent-baton"
              onChange={(e) =>
                run(() =>
                  api(`/api/standups/${standupId}/absences`, {
                    method: 'PUT',
                    body: JSON.stringify({ memberId: member.memberId, absent: e.target.checked }),
                  })
                )
              }
            />
            On leave
          </label>
        )}
      </header>

      <ul className="divide-y divide-line-soft border-t border-line-soft">
        {member.items.map((item, index) => (
          <ItemRow
            key={item.id}
            item={item}
            owner={member.memberId}
            roster={roster}
            standupId={standupId}
            editable={editable}
            busy={busy}
            run={run}
            dragging={dragId === item.id}
            isOver={overId === item.id}
            onDragStart={() => setDragId(item.id)}
            onDragEnter={() => dragId !== null && setOverId(item.id)}
            onDrop={() => drop(item.id)}
            canMoveUp={index > 0}
            canMoveDown={index < member.items.length - 1}
            onMove={(dir) => move(item.id, dir)}
          />
        ))}
        {member.items.length === 0 && (
          <li className="py-3 text-sm text-dim">
            {member.isAbsent ? 'On leave.' : 'No tasks yet.'}
          </li>
        )}
      </ul>

      {editable && member.isActive && (
        <form
          className="flex flex-wrap gap-2 border-t border-line-soft pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            const payload = { memberId: member.memberId, title, links: link ? [link] : [] };
            setTitle('');
            setLink('');
            run(() =>
              api(`/api/standups/${standupId}/items`, {
                method: 'POST',
                body: JSON.stringify(payload),
              })
            );
          }}
        >
          <label htmlFor={`new-task-${member.memberId}`} className={`${ui.label} basis-full`}>
            Add a task
          </label>
          <input
            id={`new-task-${member.memberId}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ship the retry fix"
            className={`${ui.input} min-w-0 flex-1 py-1.5`}
          />
          <label htmlFor={`new-task-link-${member.memberId}`} className="sr-only">
            Link
          </label>
          <input
            id={`new-task-link-${member.memberId}`}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Jira or GitHub URL (optional)"
            className={`${ui.input} w-full py-1.5 sm:w-60`}
          />
          <button disabled={busy} className={`${ui.btn} ${ui.btnGhost} py-1.5`}>
            <Plus size={15} /> Add
          </button>
        </form>
      )}
    </section>
  );
}

function ItemRow({
  item,
  owner,
  roster,
  standupId,
  editable,
  busy,
  run,
  dragging,
  isOver,
  onDragStart,
  onDragEnter,
  onDrop,
  canMoveUp,
  canMoveDown,
  onMove,
}: {
  item: Item;
  owner: number;
  roster: MemberRow[];
  standupId: number;
  editable: boolean;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  dragging: boolean;
  isOver: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDrop: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (dir: -1 | 1) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Leaving the confirm would otherwise drop focus on <body>, sending a
  // keyboard user back to the top of the page.
  const trashRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (wasConfirming.current && !confirming) trashRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);
  // One blank link row so there is always somewhere to paste.
  const freshDraft = () => ({
    title: item.title,
    comment: item.comment,
    memberId: owner,
    links: item.links.length > 0 ? item.links.map((l) => l.url) : [''],
  });
  const [draft, setDraft] = useState(freshDraft);

  const url = `/api/standups/${standupId}/items/${item.id}`;
  const setLinkAt = (index: number, value: string) =>
    setDraft((d) => ({ ...d, links: d.links.map((l, i) => (i === index ? value : l)) }));

  if (editing) {
    return (
      <li className="space-y-2 rounded bg-baton/8 px-3 py-3">
        <label htmlFor={`edit-task-${item.id}`} className="sr-only">
          Task
        </label>
        <input
          id={`edit-task-${item.id}`}
          autoFocus
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Task"
          className={`${ui.input} w-full py-1.5`}
        />
        <label htmlFor={`edit-task-comment-${item.id}`} className="sr-only">
          Comment
        </label>
        <input
          id={`edit-task-comment-${item.id}`}
          value={draft.comment}
          onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
          placeholder="Comment"
          className={`${ui.input} w-full py-1.5`}
        />

        {roster.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor={`edit-task-owner-${item.id}`} className="text-xs text-dim">
              Assigned to
            </label>
            <select
              id={`edit-task-owner-${item.id}`}
              value={draft.memberId}
              onChange={(e) => setDraft({ ...draft, memberId: Number(e.target.value) })}
              className={`${ui.input} py-1.5`}
            >
              {roster.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {m.memberName}
                </option>
              ))}
            </select>
            {draft.memberId !== owner && (
              <span className="text-xs text-dim">Moves on save, keeping its {item.daysDragging}d age.</span>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          {draft.links.map((value, index) => (
            <div key={index} className="flex gap-2">
              <label htmlFor={`edit-task-link-${item.id}-${index}`} className="sr-only">
                Link {index + 1}
              </label>
              <input
                id={`edit-task-link-${item.id}-${index}`}
                value={value}
                onChange={(e) => setLinkAt(index, e.target.value)}
                placeholder="Jira ticket, GitHub PR, anything else"
                className={`${ui.input} min-w-0 flex-1 py-1.5`}
              />
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => {
                    const links = d.links.filter((_, i) => i !== index);
                    return { ...d, links: links.length > 0 ? links : [''] };
                  })
                }
                aria-label={`Remove link ${index + 1}`}
                className={`${ui.btn} ${ui.btnSubtle} px-2 py-1.5`}
              >
                <X size={15} />
              </button>
            </div>
          ))}
          {draft.links.length < MAX_LINKS && (
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, links: [...d.links, ''] }))}
              className="text-xs font-medium text-baton hover:underline"
            >
              + Add link
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            disabled={busy || !draft.title.trim()}
            onClick={() => {
              setEditing(false);
              run(() => api(url, { method: 'PUT', body: JSON.stringify(draft) }));
            }}
            className={`${ui.btn} ${ui.btnPrimary} py-1.5`}
          >
            Save
          </button>
          <button
            onClick={() => {
              setDraft(freshDraft());
              setEditing(false);
            }}
            className={`${ui.btn} ${ui.btnSubtle} py-1.5`}
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      draggable={editable}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`group flex flex-wrap items-start gap-2 py-3 transition ${
        dragging ? 'opacity-40' : ''
      } ${isOver ? 'border-t-2 border-baton' : ''}`}
    >
      {editable && (
        <div className={`mt-0.5 flex shrink-0 flex-col items-center gap-0.5 ${ui.rowAction}`}>
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={!canMoveUp || busy}
            aria-label="Move up"
            className="grid size-6 place-items-center rounded text-dim transition hover:bg-chalk/8 hover:text-chalk disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronUp size={13} />
          </button>
          <GripVertical size={15} aria-hidden="true" className="cursor-grab text-dim active:cursor-grabbing" />
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={!canMoveDown || busy}
            aria-label="Move down"
            className="grid size-6 place-items-center rounded text-dim transition hover:bg-chalk/8 hover:text-chalk disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronDown size={13} />
          </button>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm ${item.status === 'done' ? 'text-dim line-through' : ''}`}>
            {item.title}
          </span>
          <LinkChips links={item.links} />
          {item.carriedFromId !== null && (
            <span
              title={`Carried forward — first raised ${item.daysDragging} day(s) ago`}
              className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${daysTone(item.daysDragging)}`}
            >
              {item.daysDragging}d
            </span>
          )}
        </div>
        {item.comment && <p className="mt-0.5 text-xs text-dim">{item.comment}</p>}

        {/* The lane. Width is how long this has been running, fill is its state —
            the same three shapes the reports and the team list draw. */}
        <div aria-hidden="true" className="mt-2 h-1 w-full max-w-64 rounded-full bg-chalk/8">
          <div
            className={`h-full rounded-full ${
              item.status === 'done'
                ? 'bg-baton'
                : item.status === 'blocked'
                  ? 'hatch border border-stall'
                  : 'bg-chalk/30'
            }`}
            style={{ width: laneWidth(item.daysDragging) }}
          />
        </div>
      </div>

      {editable ? (
        <div className="flex basis-full items-center justify-end gap-1 sm:basis-auto">
          <div className="flex rounded-lg border border-line p-0.5">
            {STATUS_OPTIONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                title={label}
                aria-label={label}
                aria-pressed={item.status === value}
                disabled={busy || item.status === value}
                onClick={() =>
                  run(() => api(url, { method: 'PUT', body: JSON.stringify({ status: value }) }))
                }
                className={`grid size-6 place-items-center rounded-md transition ${
                  item.status === value
                    ? `${statusPill[value]} ring-1`
                    : 'text-dim hover:bg-chalk/8 hover:text-chalk'
                }`}
              >
                <Icon size={13} />
              </button>
            ))}
          </div>

          <button
            onClick={() => setEditing(true)}
            title="Edit"
            aria-label="Edit task"
            className={`grid size-7 place-items-center rounded-md text-dim hover:bg-chalk/8 hover:text-chalk ${ui.rowAction}`}
          >
            <Pencil size={14} />
          </button>

          {confirming ? (
            <span className="flex items-center gap-1 text-xs">
              <button
                onClick={() => {
                  setConfirming(false);
                  run(() => api(url, { method: 'DELETE' }));
                }}
                className="rounded bg-stall px-2 py-1 text-baton-ink transition hover:brightness-105"
              >
                Delete
              </button>
              <button
                autoFocus
                onClick={() => setConfirming(false)}
                className="rounded-md px-1.5 py-1 text-dim hover:bg-chalk/8"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              ref={trashRef}
              onClick={() => setConfirming(true)}
              title="Delete"
              aria-label="Delete task"
              className={`grid size-7 place-items-center rounded-md text-dim hover:bg-stall/10 hover:text-stall ${ui.rowAction}`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ) : (
        <span className={`${pill} ${statusPill[item.status]}`}>
          {item.status}
        </span>
      )}
    </li>
  );
}
