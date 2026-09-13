'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useRun } from '@/lib/useRun';
import { ui } from '@/lib/ui';

interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  /** Tasks this person has finished on this team, all time. */
  finished: number;
}

export default function Members({
  teamId,
  teamName,
  isLead,
  myMemberId,
  members,
  addable,
  org,
}: {
  teamId: number;
  teamName: string;
  isLead: boolean;
  myMemberId: number;
  members: Member[];
  /** People in the org who are not on this team yet. */
  addable: { email: string; name: string; returning: boolean }[];
  org: { name: string; slug: string };
}) {
  const [form, setForm] = useState({ email: '', role: 'member' });
  const [saved, setSaved] = useState('');
  // Deactivating yourself hands your own access to the other lead — the one
  // change on this page you cannot undo, so it asks first.
  const [confirmingSelf, setConfirmingSelf] = useState(false);
  const { run, error, busy } = useRun();

  /** Every save on this page is instant, so every save says what it did. */
  const save = (what: string, fn: () => Promise<unknown>) =>
    run(async () => {
      await fn();
      setSaved(what);
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/teams/${teamId}`} className="text-sm text-dim hover:text-baton">
            ← {teamName}
          </Link>
          <h1 className={`${ui.h1} mt-1`}>
            Who runs <span className="text-baton">this lane</span>
          </h1>
        </div>
        <p className="text-sm text-dim tabular-nums">
          {members.filter((m) => m.isActive).length} on the team
          {members.some((m) => !m.isActive) &&
            ` · ${members.filter((m) => !m.isActive).length} removed`}
        </p>
      </div>

      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      <p role="status" className="sr-only">
        {saved}
      </p>

      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2.5">
        <h2 className={ui.h2}>On the team</h2>
        <p className="text-xs text-dim">Role changes save the moment you pick one</p>
      </div>
      <div>
        {members.map((member, lane) => (
          <div
            key={member.id}
            className={`flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line-soft py-4 ${
              member.isActive ? '' : 'opacity-70'
            }`}
          >
            <span
              aria-hidden="true"
              className="display w-8 shrink-0 border-r border-line-soft pr-3 text-right text-xl text-dim"
            >
              {member.isActive ? lane + 1 : '—'}
            </span>
            {/* Full line below sm: beside two fixed-width controls, a shrinkable
                text block gets squeezed to nothing instead of wrapping. */}
            <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
              <p className={`font-medium ${member.isActive ? '' : 'text-dim line-through'}`}>
                {member.name}
                {member.id === myMemberId && (
                  <span className="ml-2 rounded bg-baton px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-baton-ink">
                    you
                  </span>
                )}
              </p>
              <p className="truncate text-sm text-dim" title={member.email}>
                {member.email}
              </p>
              <p className="mt-0.5 text-xs text-dim tabular-nums">
                finished <b className="font-semibold text-chalk">{member.finished}</b>
                {member.role === 'observer' && ' · reads the board, posts nothing'}
              </p>
            </div>

            {isLead ? (
              <>
                <select
                  aria-label={`Role for ${member.name}`}
                  value={member.role}
                  disabled={busy}
                  onChange={(e) =>
                    save(
                      `${member.name} is now a ${e.target.value}`,
                      () =>
                        api(`/api/teams/${teamId}/members/${member.id}`, {
                          method: 'PUT',
                          body: JSON.stringify({ role: e.target.value }),
                        }),
                    )
                  }
                  className={`${ui.input} py-1.5`}
                >
                  <option value="member">Member</option>
                  <option value="observer">Observer</option>
                  <option value="lead">Lead</option>
                </select>
                {confirmingSelf && member.id === myMemberId ? (
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-dim">Give up your own access to this team?</span>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setConfirmingSelf(false);
                        save('You left the team', () =>
                          api(`/api/teams/${teamId}/members/${member.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ isActive: false }),
                          }),
                        );
                      }}
                      className={`${ui.btn} bg-stall py-1.5 text-baton-ink hover:brightness-105`}
                    >
                      Deactivate me
                    </button>
                    <button
                      autoFocus
                      onClick={() => setConfirmingSelf(false)}
                      className={`${ui.btn} ${ui.btnSubtle} py-1.5`}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => {
                      // Only your own row can lock you out, so only it asks.
                      if (member.id === myMemberId && member.isActive)
                        return setConfirmingSelf(true);
                      save(`${member.name} ${member.isActive ? 'deactivated' : 'restored'}`, () =>
                        api(`/api/teams/${teamId}/members/${member.id}`, {
                          method: 'PUT',
                          body: JSON.stringify({
                            isActive: !member.isActive,
                          }),
                        }),
                      );
                    }}
                    className={`${ui.btn} ${ui.btnGhost} py-1.5`}
                  >
                    {member.isActive ? 'Deactivate' : 'Restore'}
                  </button>
                )}
              </>
            ) : (
              <span className="rounded-full bg-chalk/10 px-2.5 py-0.5 text-xs text-dim">
                {member.role}
              </span>
            )}
          </div>
        ))}
        {members.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-dim">No members yet.</p>
        )}
      </div>

      {isLead && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2.5">
            <h2 className={ui.h2}>Add someone</h2>
            <p className="text-xs text-dim">They join from the next standup on</p>
          </div>
          {addable.length === 0 ? (
            <div className="pt-4 text-sm text-dim">
              Everyone in {org.name} is already on this team.{' '}
              <Link href={`/orgs/${org.slug}/members`} className="text-baton hover:underline">
                Invite more people to {org.name}
              </Link>{' '}
              and they show up here.
            </div>
          ) : (
            <form
              className="flex flex-wrap items-end gap-3 pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                const payload = { ...form };
                run(async () => {
                  await api(`/api/teams/${teamId}/members`, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                  });
                  setForm({ email: '', role: 'member' });
                });
              }}
            >
              <div className="min-w-52 flex-1">
                <label htmlFor="member-person" className={ui.label}>
                  Person
                </label>
                <select
                  id="member-person"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`${ui.input} mt-1 w-full`}
                >
                  <option value="">Pick someone from {org.name}…</option>
                  {addable.map((person) => (
                    <option key={person.email} value={person.email}>
                      {person.name} — {person.email}
                      {person.returning ? ' (was on this team)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="member-role" className={ui.label}>
                  Role
                </label>
                <select
                  id="member-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className={`${ui.input} mt-1`}
                >
                  <option value="member">Member</option>
                  <option value="observer">Observer</option>
                  <option value="lead">Lead</option>
                </select>
              </div>
              <button disabled={busy || !form.email} className={`${ui.btn} ${ui.btnPrimary}`}>
                <Plus size={16} /> Add to team
              </button>
            </form>
          )}

          <p className="text-sm text-dim">
            A member is matched to their login by work email. Until they sign in, their tasks still
            show on the board — you just enter them on their behalf.
          </p>
          <p className="text-sm text-dim">
            An <strong className="font-medium">observer</strong> reads the board, the walkthrough
            and the reports, and changes nothing.
          </p>
        </div>
      )}
    </div>
  );
}
