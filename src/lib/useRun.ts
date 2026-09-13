'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Every mutation goes through here: call the API, then re-render on the server.
 * `busy` covers both halves — the request, then the refresh — so a form stays
 * disabled until the new server render lands.
 */
export function useRun() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setSaving(true);
      try {
        await fn();
        setError('');
        startTransition(() => router.refresh());
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [router]
  );

  return { run, error, setError, busy: saving || pending };
}
