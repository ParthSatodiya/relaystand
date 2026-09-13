'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useRun } from '@/lib/useRun';
import { ui } from '@/lib/ui';

interface OrgRef {
  name: string;
  slug: string;
}

export default function Onboarding({
  firstTime,
  pending,
  suggestions,
}: {
  firstTime: boolean;
  pending: OrgRef[];
  suggestions: OrgRef[];
}) {
  const router = useRouter();
  const { run, error, busy } = useRun();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [slug, setSlug] = useState('');
  const [asked, setAsked] = useState('');

  const join = (target: string) =>
    run(async () => {
      const res = await api<{ org: OrgRef }>(`/api/orgs/${target.trim()}/join`, { method: 'POST' });
      setAsked(res.org.name);
      setSlug('');
      router.refresh();
    });

  return (
    <div className="max-w-2xl space-y-7">
      <div>
        <h1 className={ui.h1}>
          {firstTime ? 'Set up RelayStand' : 'Create or join an organisation'}
        </h1>
        <p className="mt-2 max-w-[56ch] text-sm text-dim">
          An organisation holds your teams, their standups and everyone who can see them.
        </p>
      </div>

      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      {asked && (
        <p role="status" className="rounded border border-baton border-l-4 bg-baton/10 px-3 py-2 text-sm text-chalk">
          Asked to join {asked}. An admin there decides who gets in.
        </p>
      )}

      {pending.length > 0 && (
        <div>
          <h2 className={`${ui.h2} border-b border-line pb-2.5`}>Waiting on an admin</h2>
          <ul className="mt-3 space-y-1 text-sm text-dim">
            {pending.map((o) => (
              <li key={o.slug}>{o.name}</li>
            ))}
          </ul>
        </div>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const org = await api<{ slug: string }>('/api/orgs', {
              method: 'POST',
              body: JSON.stringify({ name, emailDomain: domain }),
            });
            router.push(`/orgs/${org.slug}`);
          });
        }}
      >
        <h2 className={`${ui.h2} border-b border-line pb-2.5`}>Create an organisation</h2>
        <div>
          <label htmlFor="org-name" className={ui.label}>
            Name
          </label>
          <input
            id="org-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Payments"
            className={`${ui.input} mt-1 w-full`}
          />
        </div>
        <div>
          <label htmlFor="org-domain" className={ui.label}>
            Work email domain (optional)
          </label>
          <input
            id="org-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="acme.com"
            className={`${ui.input} mt-1 w-full`}
          />
          <p className="mt-1 text-xs text-dim">
            Set this and colleagues on that domain find the org by themselves. They still wait for
            your approval. Leave it blank if your team signs in with personal addresses.
          </p>
        </div>
        <button disabled={busy || !name.trim()} className={`${ui.btn} ${ui.btnPrimary}`}>
          Create organisation
        </button>
      </form>

      <div className="space-y-4">
        <h2 className={`${ui.h2} border-b border-line pb-2.5`}>Join one instead</h2>

        {suggestions.length > 0 && (
          <ul className="space-y-2">
            {suggestions.map((o) => (
              <li
                key={o.slug}
                className="flex flex-wrap items-center gap-2 border-b border-line-soft py-2.5 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                <button
                  disabled={busy}
                  onClick={() => join(o.slug)}
                  className={`${ui.btn} ${ui.btnGhost} py-1.5`}
                >
                  Ask to join
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (slug.trim()) join(slug);
          }}
        >
          <div className="min-w-48 flex-1">
            <label htmlFor="join-slug" className={ui.label}>
              Organisation name from your colleague
            </label>
            <input
              id="join-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="acme-payments"
              className={`${ui.input} mt-1 w-full`}
            />
          </div>
          <button disabled={busy || !slug.trim()} className={`${ui.btn} ${ui.btnGhost}`}>
            Ask to join
          </button>
        </form>
      </div>
    </div>
  );
}
