// Supabase Storage helpers (service-role key — server-side only).
// Uses the REST API directly — no SDK dependency required.

import 'server-only';
import { log } from './logger';

const PROJECT_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BUCKET      = process.env.SUPABASE_BUCKET ?? 'media';

function storageUrl(path: string) {
  return `${PROJECT_URL}/storage/v1/object/${path}`;
}

export function getPublicUrl(filePath: string) {
  return `${PROJECT_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;
}

/** Upload a Buffer/Uint8Array to Supabase Storage. Returns public URL. */
export async function uploadFile(opts: {
  filePath: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<{ url: string }> {
  if (!PROJECT_URL || !SERVICE_KEY) {
    throw new Error('Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)');
  }

  const url = storageUrl(`${BUCKET}/${opts.filePath}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': opts.contentType,
      'x-upsert': 'true',
    },
    body: opts.body as BodyInit,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    log.error('supabase.upload_failed', { status: res.status, body: text.slice(0, 200) });
    throw new Error(`Supabase upload failed: ${res.status}`);
  }

  return { url: getPublicUrl(opts.filePath) };
}

/** Delete one or more files from the bucket. */
export async function deleteFiles(filePaths: string[]): Promise<void> {
  if (!PROJECT_URL || !SERVICE_KEY) return;

  const url = storageUrl(`${BUCKET}`);
  await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: filePaths }),
  }).catch(() => {});
}

/** List files under a prefix in the bucket. */
export async function listFiles(prefix: string): Promise<Array<{ name: string; id: string }>> {
  if (!PROJECT_URL || !SERVICE_KEY) return [];

  const url = `${PROJECT_URL}/storage/v1/object/list/${BUCKET}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefix, limit: 200, offset: 0 }),
  });

  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

/**
 * Create a signed upload URL so the browser can PUT a file directly to Supabase
 * without routing the binary through the Next.js server.
 * Returns the full URL the client should PUT to, plus the final public URL.
 */
export async function createSignedUploadUrl(filePath: string): Promise<{ uploadUrl: string; publicUrl: string }> {
  if (!PROJECT_URL || !SERVICE_KEY) {
    throw new Error('Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)');
  }

  const res = await fetch(`${PROJECT_URL}/storage/v1/object/upload/sign/${BUCKET}/${filePath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_KEY}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to create signed upload URL: ${res.status} ${text.slice(0, 200)}`);
  }

  const json = await res.json() as { url: string; token: string };
  // The REST API returns a path WITHOUT the `/storage/v1` prefix, e.g.
  //   /object/upload/sign/media/homepage/uuid.mp4?token=...
  // The browser must PUT to the full storage path; otherwise it hits a 404 on
  // the gateway which has no CORS headers, and the upload fails with a generic
  // "Network error". Prepend `/storage/v1` defensively (no-op if already there).
  const path = json.url.startsWith('/storage/v1') ? json.url : `/storage/v1${json.url}`;
  const uploadUrl = `${PROJECT_URL}${path}`;
  const publicUrl = getPublicUrl(filePath);
  return { uploadUrl, publicUrl };
}

/** Check if Supabase storage is reachable. Returns true if healthy. */
export async function checkHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  if (!PROJECT_URL || !SERVICE_KEY) return { ok: false, latencyMs: 0 };
  const start = Date.now();
  try {
    const res = await fetch(`${PROJECT_URL}/storage/v1/bucket`, {
      headers: { Authorization: `Bearer ${SERVICE_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    return { ok: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
