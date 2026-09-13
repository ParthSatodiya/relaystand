import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '@/lib/http';

/**
 * File storage behind one small interface, the way Django puts every backend
 * behind `Storage`. Today there is one backend — the local disk. Adding S3,
 * GCS or Azure means a new file implementing `Storage` and one line in
 * `storage()`; nothing that saves or reads a file has to change.
 *
 *   STORAGE_BACKEND=local            (default)
 *   UPLOAD_DIR=./data/uploads        (local backend only; a Docker volume in prod)
 */
export interface Storage {
  /** Write bytes under `key`, replacing anything already there. */
  save(key: string, data: Buffer): Promise<void>;
  /** Read bytes back, or null when the key is gone. */
  read(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  /**
   * Where a browser fetches it. The local backend streams through our own
   * route because the disk is not web-served; a cloud backend would return its
   * own (optionally signed) URL and the route would redirect there.
   */
  url(key: string): string;
}

export const MAX_UPLOAD_BYTES = 512 * 1024; // 512 KB — a logo, not a photo album

/** Only formats a browser renders inline and that carry no script. */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** Keys are ours to mint, but never trust one arriving from a request. */
export function safeKey(key: string) {
  if (!/^[a-zA-Z0-9._-]{1,120}$/.test(key) || key.startsWith('.')) {
    throw new HttpError(400, 'Invalid file name');
  }
  return key;
}

class LocalStorage implements Storage {
  constructor(private dir: string) {}

  private file(key: string) {
    return path.join(this.dir, safeKey(key));
  }

  async save(key: string, data: Buffer) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.file(key), data);
  }

  async read(key: string) {
    try {
      return await readFile(this.file(key));
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await unlink(this.file(key)).catch(() => {});
  }

  url(key: string) {
    return `/api/files/${safeKey(key)}`;
  }
}

let cached: Storage | null = null;

export function storage(): Storage {
  if (cached) return cached;
  const backend = process.env.STORAGE_BACKEND || 'local';
  switch (backend) {
    case 'local':
      cached = new LocalStorage(process.env.UPLOAD_DIR || path.join(process.cwd(), 'data/uploads'));
      return cached;
    default:
      // Fail loudly at first use rather than silently writing nowhere.
      throw new Error(`Unknown STORAGE_BACKEND "${backend}" — add its class in src/lib/storage.ts`);
  }
}

/** Content type for a stored key, from its extension. */
export function contentTypeOf(key: string) {
  const ext = key.split('.').pop();
  const entry = Object.entries(ALLOWED_IMAGE_TYPES).find(([, e]) => e === ext);
  return entry ? entry[0] : 'application/octet-stream';
}
