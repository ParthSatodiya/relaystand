'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { parseRecipients } from '@/lib/emails';
import { useRun } from '@/lib/useRun';
import { ui } from '@/lib/ui';

interface Person {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
}

export default function OrgPeople({
  slug,
  orgName,
  isAdmin,
  myEmail,
  people,
}: {
  slug: string;
  orgName: string;
  isAdmin: boolean;
  myEmail: string;
  people: { pending: Person[]; active: Person[]; deactivated: Person[] };
}) {
  const { run, error, busy } = useRun();
  const [saved, setSaved] = useState('');
  const [invite, setInvite] = useState({ name: '', email: '', role: 'member' });
  const [paste, setPaste] = useState({ emails: '', role: 'member' });
  const [report, setReport] = useState<{ email: string; name: string; outcome: string }[] | null>(
    null,
  );
  // The same parser the server uses, so the preview cannot promise something
  // the import then does differently.
  const preview = useMemo(() => parseRecipients(paste.emails), [paste.emails]);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');

  const base = `/api/orgs/${slug}/members`;
  const save = (what: string, fn: () => Promise<unknown>) =>
    run(async () => {
      await fn();
      setSaved(what);
    });
  const patch = (person: Person, body: object, what: string) =>
    save(what, () => api(`${base}/${person.id}`, { method: 'PUT', body: JSON.stringify(body) }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className={ui.h1}>People in {orgName}</h1>
        <p className="mt-1 text-sm text-dim">
          Everyone here can be put on a team. Deactivating someone closes the door without deleting
          a thing they wrote — restore them and every standup is exactly where they left it.
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

      {isAdmin && people.pending.length > 0 && (
        <section>
          <h2 className={`${ui.h2} border-b border-line pb-2.5`}>
            Asking to join ({people.pending.length})
          </h2>
          <ul className="divide-y divide-line-soft">
            {people.pending.map((person) => (
              <li key={person.id} className="flex flex-wrap items-center gap-3 py-3.5">
                <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                  <p className="font-medium">{person.name}</p>
                  <p className="truncate text-sm text-dim">{person.email}</p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => patch(person, { status: 'active' }, `${person.name} approved`)}
                  className={`${ui.btn} ${ui.btnPrimary} py-1.5`}
                >
                  Approve
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    save(`${person.name} turned down`, () =>
                      api(`${base}/${person.id}`, { method: 'DELETE' }),
                    )
                  }
                  className={`${ui.btn} ${ui.btnGhost} py-1.5`}
                >
                  Turn down
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className={`${ui.h2} border-b border-line pb-2.5`}>In the organisation</h2>
        <ul className="divide-y divide-line-soft">
          {[...people.active, ...people.deactivated].map((person) => (
            <li key={person.id} className="flex flex-wrap items-center gap-3 py-3.5">
              <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                {renaming === person.id ? (
                  <form
                    className="flex flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setRenaming(null);
                      patch(person, { name: draftName }, 'Name saved');
                    }}
                  >
                    <label htmlFor={`rename-${person.id}`} className="sr-only">
                      Name
                    </label>
                    <input
                      id={`rename-${person.id}`}
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className={`${ui.input} min-w-0 flex-1 py-1.5`}
                    />
                    <button className={`${ui.btn} ${ui.btnPrimary} py-1.5`}>Save</button>
                    <button
                      type="button"
                      onClick={() => setRenaming(null)}
                      className={`${ui.btn} ${ui.btnSubtle} py-1.5`}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <p
                      className={`font-medium ${
                        person.status === 'deactivated' ? 'text-dim line-through' : ''
                      }`}
                    >
                      {person.name}
                      {person.email === myEmail && (
                        <span className="ml-1.5 text-xs font-normal text-dim">you</span>
                      )}
                    </p>
                    <p className="truncate text-sm text-dim" title={person.email}>
                      {person.email}
                    </p>
                  </>
                )}
              </div>

              {isAdmin ? (
                <>
                  {renaming !== person.id && (
                    <button
                      onClick={() => {
                        setDraftName(person.name);
                        setRenaming(person.id);
                      }}
                      className={`${ui.btn} ${ui.btnSubtle} py-1.5`}
                    >
                      Rename
                    </button>
                  )}
                  <label htmlFor={`role-${person.id}`} className="sr-only">
                    Organisation role for {person.name}
                  </label>
                  <select
                    id={`role-${person.id}`}
                    value={person.role}
                    disabled={busy || person.status !== 'active'}
                    onChange={(e) =>
                      patch(
                        person,
                        { role: e.target.value },
                        `${person.name} is now an org ${e.target.value}`,
                      )
                    }
                    className={`${ui.input} py-1.5`}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    disabled={busy}
                    onClick={() =>
                      patch(
                        person,
                        { status: person.status === 'active' ? 'deactivated' : 'active' },
                        `${person.name} ${person.status === 'active' ? 'deactivated' : 'restored'}`,
                      )
                    }
                    className={`${ui.btn} ${ui.btnGhost} py-1.5`}
                  >
                    {person.status === 'active' ? 'Deactivate' : 'Restore'}
                  </button>
                </>
              ) : (
                <span className="rounded-full bg-chalk/10 px-2.5 py-0.5 text-xs text-dim">
                  {person.role}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isAdmin && (
        <>
          <section className="space-y-3">
            <h2 className={ui.h2}>Invite someone</h2>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                save(`${invite.name} invited`, async () => {
                  await api(base, { method: 'POST', body: JSON.stringify(invite) });
                  setInvite({ name: '', email: '', role: 'member' });
                });
              }}
            >
              <div className="min-w-40 flex-1">
                <label htmlFor="invite-name" className={ui.label}>
                  Name
                </label>
                <input
                  id="invite-name"
                  required
                  value={invite.name}
                  onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                  placeholder="Asha Menon"
                  className={`${ui.input} mt-1 w-full`}
                />
              </div>
              <div className="min-w-52 flex-1">
                <label htmlFor="invite-email" className={ui.label}>
                  Work email
                </label>
                <input
                  id="invite-email"
                  required
                  type="email"
                  value={invite.email}
                  onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                  placeholder="asha@company.com"
                  className={`${ui.input} mt-1 w-full`}
                />
              </div>
              <div>
                <label htmlFor="invite-role" className={ui.label}>
                  Role
                </label>
                <select
                  id="invite-role"
                  value={invite.role}
                  onChange={(e) => setInvite({ ...invite, role: e.target.value })}
                  className={`${ui.input} mt-1`}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button disabled={busy} className={`${ui.btn} ${ui.btnPrimary}`}>
                <Plus size={16} /> Invite
              </button>
            </form>
            <p className="text-sm text-dim">
              They join the moment they first sign in with that address. No email is sent yet — tell
              them to go to RelayStand and sign in.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className={ui.h2}>Add several at once</h2>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                save('People imported', async () => {
                  const res = await api<{
                    added: number;
                    results: { email: string; name: string; outcome: string }[];
                  }>(base, { method: 'POST', body: JSON.stringify(paste) });
                  setReport(res.results);
                  setPaste({ emails: '', role: paste.role });
                });
              }}
            >
              <div>
                <label htmlFor="paste-emails" className={ui.label}>
                  Paste email addresses
                </label>
                <textarea
                  id="paste-emails"
                  rows={4}
                  value={paste.emails}
                  onChange={(e) => {
                    setPaste({ ...paste, emails: e.target.value });
                    setReport(null);
                  }}
                  placeholder={'asha@company.com, dev.raval@company.com\nMei Lin <mei@company.com>'}
                  className={`${ui.input} mt-1 w-full resize-y font-mono text-xs`}
                />
                <p className="mt-1 text-xs text-dim">
                  Commas, spaces or new lines. Names come from the address — dev.raval@company.com
                  becomes Dev Raval — and you can rename anyone afterwards.
                </p>
              </div>

              {(preview.recipients.length > 0 || preview.invalid.length > 0) && (
                <div className="rounded-lg border border-line bg-raised p-3 text-sm">
                  <p className="font-medium">
                    {preview.recipients.length}{' '}
                    {preview.recipients.length === 1 ? 'address' : 'addresses'} found
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {preview.recipients.slice(0, 6).map((r) => (
                      <li key={r.email} className="flex flex-wrap gap-x-2 text-dim">
                        <span className="font-medium text-chalk">{r.name}</span>
                        <span className="truncate">{r.email}</span>
                      </li>
                    ))}
                  </ul>
                  {preview.recipients.length > 6 && (
                    <p className="mt-1 text-xs text-dim">
                      and {preview.recipients.length - 6} more
                    </p>
                  )}
                  {preview.invalid.length > 0 && (
                    <p className="mt-1.5 text-xs text-stall">
                      Not an address, will be skipped: {preview.invalid.slice(0, 4).join(', ')}
                      {preview.invalid.length > 4 ? ` and ${preview.invalid.length - 4} more` : ''}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="paste-role" className={ui.label}>
                    Add them all as
                  </label>
                  <select
                    id="paste-role"
                    value={paste.role}
                    onChange={(e) => setPaste({ ...paste, role: e.target.value })}
                    className={`${ui.input} mt-1`}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button
                  disabled={busy || preview.recipients.length === 0}
                  className={`${ui.btn} ${ui.btnPrimary}`}
                >
                  <Plus size={16} /> Add {preview.recipients.length || ''}{' '}
                  {preview.recipients.length === 1 ? 'person' : 'people'}
                </button>
              </div>
            </form>

            {report && (
              <div className="rounded-lg border border-line p-3 text-sm">
                <p className="font-medium">
                  {report.filter((r) => r.outcome === 'added').length} added
                </p>
                <ul className="mt-1.5 space-y-0.5 text-dim">
                  {report
                    .filter((r) => r.outcome !== 'added')
                    .map((r) => (
                      <li key={r.email}>
                        <span className="font-mono text-xs">{r.email}</span>{' '}
                        {r.outcome === 'already'
                          ? '— already here'
                          : r.outcome === 'deactivated'
                            ? '— deactivated, restore them above'
                            : '— not an email address'}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
