/**
 * Test double for `firebase-admin/storage`.
 *
 * Records every `file().save()` so tests can assert what was uploaded (path,
 * bytes, content type) without a real Storage bucket.
 */

import type { App } from './admin-app';

export interface SavedFile {
  path: string;
  contents: Uint8Array;
  contentType?: string;
}

let saved: SavedFile[] = [];

/** Test helper: reset recorded uploads. */
export function __resetStorage(): void {
  saved = [];
}

/** Test helper: read recorded uploads (for assertions). */
export function __getSavedFiles(): SavedFile[] {
  return saved;
}

interface SaveOptions {
  contentType?: string;
  metadata?: unknown;
  resumable?: boolean;
}

function makeBucket(name: string) {
  return {
    name,
    file: (path: string) => ({
      name: path,
      save: async (contents: Uint8Array, opts: SaveOptions = {}): Promise<void> => {
        saved.push({ path, contents, contentType: opts.contentType });
      },
    }),
  };
}

export function getStorage(_app: App) {
  return {
    bucket: (name?: string) => makeBucket(name ?? 'soteria-assurance.appspot.com'),
  };
}
