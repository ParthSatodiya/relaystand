'use client';

/** Thin fetch wrapper: throws the server's error message so the UI can show it. */
export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  // A dropped connection throws a raw "Failed to fetch" — not something to put
  // in front of someone mid-standup.
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new Error('Unable to reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return null as T;

  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new Error(
      (data as { error?: string })?.error || 'Unable to complete that action. Check your connection and try again.'
    );
  return data as T;
}
