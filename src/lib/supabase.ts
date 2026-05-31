// Supabase Storage helpers (service-role key — server-side only).
// Uses the REST API directly — no SDK dependency required.

import 'server-only';
import { log } from './logger';

const PROJECT_URL = 'https://frdaptccanpnnqhfgewf.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZGFwdGNjYW5wbm5xaGZnZXdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTUyNzQwMSwiZXhwIjoyMDk1MTAzNDAxfQ.9NJQoGYCJvnHg-BVte6QSQjQ2ZBn8AUfw8x-zu8ALFg';
const BUCKET      = 'media';

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
  // json.url is a path like /storage/v1/object/upload/sign/media/homepage/uuid.mp4?token=...
  const uploadUrl = `${PROJECT_URL}${json.url}`;
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
