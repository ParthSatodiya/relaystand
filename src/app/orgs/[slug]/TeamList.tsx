'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { ui } from '@/lib/ui';

interface Team {
  id: number;
  name: string;
  memberCount: number;
  myRole: string;
  todayStandup: {
    date: string;
    heldAt: string;
    totalItems: number;
    doneItems: number;
    openItems: number;
    blockedItems: number;
    longestDays: number;
  } | null;
}

export default function TeamList({
  orgId,
  orgName,
  teams,
  today,
}: {
  orgId: number;
  orgName: string;
  teams: Team[];
  today: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  function act(fn: () => Promise<unknown>) {
    setBusy(true);
    fn()
      .then(() => {
        setError('');
        router.refresh();
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setBusy(false));
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={ui.h1}>
            Teams in <span className="text-baton">{orgName}</span>
          </h1>
          <p className="mt-2 text-sm text-dim">
            {format(parseISO(today), 'EEEE d MMMM')} — the lane shows where each team is up to.
          </p>
        </div>
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              act(async () => {
                await api('/api/teams', { method: 'POST', body: JSON.stringify({ name, orgId }) });
                setName('');
                setAdding(false);
              });
            }}
            className="flex flex-wrap gap-2"
          >
            <label htmlFor="new-team-name" className="sr-only">
              New team name
            </label>
            <input
              id="new-team-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Team name"
              className={ui.input}
            />
            <button disabled={busy} className={`${ui.btn} ${ui.btnPrimary}`}>
              Create team
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className={`${ui.btn} ${ui.btnSubtle}`}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className={`${ui.btn} ${ui.btnGhost}`}>
            <Plus size={16} /> Add a team
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className={`${ui.error} mt-4`}>
          {error}
        </p>
      )}

      {teams.length === 0 ? (
        <div className={`${ui.empty} mt-6`}>
          <p className="font-medium">No teams yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-dim">
            Create one, add the people who stand up together, and every unfinished task carries
            itself forward from there.
          </p>
          <button onClick={() => setAdding(true)} className={`${ui.btn} ${ui.btnPrimary} mt-5`}>
            <Plus size={16} /> Add a team
          </button>
        </div>
      ) : (
        <div className="mt-6 border-t border-line">
          {teams.map((team) => {
            const s = team.todayStandup;
            const running = s ? s.totalItems - s.doneItems - s.blockedItems : 0;
            return (
              <div
                key={team.id}
                className="grid items-center gap-4 border-b border-line-soft py-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <Link
                    href={`/teams/${team.id}`}
                    className="group inline-flex items-baseline gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-baton"
                  >
                    <h2 className="display truncate text-xl group-hover:text-baton sm:text-2xl">
                      {team.name}
                    </h2>
                    {team.myRole === 'lead' && (
                      <span className="text-[11px] uppercase tracking-[0.12em] text-dim">lead</span>
                    )}
                  </Link>
                  <p className="mt-1 text-sm text-dim">
                    {team.memberCount} {team.memberCount === 1 ? 'person' : 'people'}
                  </p>
                </div>

                {/* The lane: finished, running, blocked — the three shapes the board uses. */}
                <div className="min-w-0">
                  {s ? (
                    <>
                      <div className="flex h-3.5 overflow-hidden rounded-full bg-chalk/8">
                        {s.doneItems > 0 && (
                          <span className="bg-baton" style={{ flex: s.doneItems }} />
                        )}
                        {running > 0 && <span className="bg-chalk/30" style={{ flex: running }} />}
                        {s.blockedItems > 0 && (
                          <span className="hatch" style={{ flex: s.blockedItems }} />
                        )}
                      </div>
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim tabular-nums">
                        <span>
                          <b className="font-semibold text-chalk">{s.doneItems}</b> finished
                        </span>
                        <span>
                          <b className="font-semibold text-chalk">{running}</b> running
                        </span>
                        {s.blockedItems > 0 && (
                          <span className="text-stall">
                            <b className="font-semibold">{s.blockedItems}</b> blocked
                          </span>
                        )}
                        {s.longestDays > 0 && (
                          <span>
                            longest <b className="font-semibold text-chalk">{s.longestDays}d</b>
                          </span>
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="h-3.5 rounded-full border border-dashed border-line" />
                      <p className="mt-2 text-xs text-dim">Nothing held today</p>
                    </>
                  )}
                </div>

                <div className="md:text-right">
                  {s ? (
                    <>
                      <p className="display text-xl tabular-nums">
                        {format(new Date(s.heldAt), 'HH:mm')}
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-dim">
                        Standup held
                      </p>
                    </>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(() =>
                          api(`/api/teams/${team.id}/standups`, {
                            method: 'POST',
                            body: JSON.stringify({ date: today }),
                          })
                        )
                      }
                      className={`${ui.btn} ${ui.btnPrimary}`}
                    >
                      Start standup
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
