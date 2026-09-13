'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useRun } from '@/lib/useRun';
import { ui } from '@/lib/ui';

const MAX_KB = 512;

export default function OrgSettings({
  slug,
  name: initialName,
  emailDomain: initialDomain,
  logoUrl,
}: {
  slug: string;
  name: string;
  emailDomain: string;
  logoUrl: string;
}) {
  const router = useRouter();
  const { run, error, busy } = useRun();
  const [name, setName] = useState(initialName);
  const [domain, setDomain] = useState(initialDomain);
  const [saved, setSaved] = useState('');
  const [uploadError, setUploadError] = useState('');

  async function upload(file: File) {
    setUploadError('');
    if (file.size > MAX_KB * 1024) {
      setUploadError(`That image is ${Math.round(file.size / 1024)} KB — the limit is ${MAX_KB} KB.`);
      return;
    }
    const body = new FormData();
    body.append('logo', file);
    await run(async () => {
      // No JSON header here: the browser sets the multipart boundary itself.
      const res = await fetch(`/api/orgs/${slug}/logo`, { method: 'POST', body });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Upload failed');
      setSaved('Logo updated');
      router.refresh();
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className={ui.h1}>Organisation settings</h1>

      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      {uploadError && (
        <p role="alert" className={ui.error}>
          {uploadError}
        </p>
      )}
      <p role="status" className="sr-only">
        {saved}
      </p>

      <form
        className="space-y-4 border-t border-line pt-5"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api(`/api/orgs/${slug}`, {
              method: 'PUT',
              body: JSON.stringify({ name, emailDomain: domain }),
            });
            setSaved('Settings saved');
            router.refresh();
          });
        }}
      >
        <div>
          <label htmlFor="org-name" className={ui.label}>
            Name
          </label>
          <input
            id="org-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${ui.input} mt-1 w-full`}
          />
        </div>
        <div>
          <label htmlFor="org-domain" className={ui.label}>
            Work email domain
          </label>
          <input
            id="org-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="acme.com"
            className={`${ui.input} mt-1 w-full`}
          />
          <p className="mt-1 text-xs text-dim">
            Optional. People on this domain can find the org and ask to join; you still approve
            each one. Leave it blank and the only way in is your invitation.
          </p>
        </div>
        <button disabled={busy} className={`${ui.btn} ${ui.btnPrimary}`}>
          Save settings
        </button>
      </form>

      <div className="space-y-4">
        <h2 className={`${ui.h2} border-b border-line pb-2.5`}>Logo</h2>
        <div className="flex flex-wrap items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- our storage route
            <img
              src={logoUrl}
              alt="Current logo"
              className="size-16 rounded bg-chalk object-contain p-1"
            />
          ) : (
            <span className="grid size-16 place-items-center rounded border border-dashed border-line text-xs text-dim">
              None
            </span>
          )}
          <div>
            <label htmlFor="org-logo" className={`${ui.btn} ${ui.btnGhost} cursor-pointer`}>
              Choose image
            </label>
            <input
              id="org-logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) upload(file);
              }}
            />
            <p className="mt-1 text-xs text-dim">PNG, JPEG or WebP, up to {MAX_KB} KB.</p>
          </div>
          {logoUrl && (
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api(`/api/orgs/${slug}/logo`, { method: 'DELETE' });
                  setSaved('Logo removed');
                  router.refresh();
                })
              }
              className={`${ui.btn} ${ui.btnSubtle}`}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
