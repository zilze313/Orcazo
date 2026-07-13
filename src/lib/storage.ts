// Cloudflare R2 Storage helpers (S3-compatible API — server-side only).

import 'server-only';
import { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { log } from './logger';

const R2_ENDPOINT    = process.env.R2_ENDPOINT ?? '';
const ACCESS_KEY_ID  = process.env.R2_ACCESS_KEY_ID ?? '';
const SECRET_KEY     = process.env.R2_SECRET_ACCESS_KEY ?? '';
const BUCKET         = process.env.R2_BUCKET ?? 'orcazo-media';
const PUBLIC_URL     = process.env.R2_PUBLIC_URL ?? '';

function getClient() {
  if (!R2_ENDPOINT || !ACCESS_KEY_ID || !SECRET_KEY) {
    throw new Error('R2 not configured (R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY missing)');
  }
  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_KEY },
  });
}

export function getPublicUrl(filePath: string) {
  return `${PUBLIC_URL}/${filePath}`;
}

/** Upload a Buffer/Uint8Array to R2. Returns public URL. */
export async function uploadFile(opts: {
  filePath: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<{ url: string }> {
  const client = getClient();

  try {
    await client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: opts.filePath,
      Body: opts.body,
      ContentType: opts.contentType,
    }));
  } catch (err) {
    log.error('r2.upload_failed', { error: (err as Error).message });
    throw new Error(`R2 upload failed: ${(err as Error).message}`);
  }

  return { url: getPublicUrl(opts.filePath) };
}

/** Delete one or more files from the bucket. */
export async function deleteFiles(filePaths: string[]): Promise<void> {
  if (!R2_ENDPOINT || !ACCESS_KEY_ID || !SECRET_KEY) return;
  if (filePaths.length === 0) return;

  const client = getClient();
  try {
    await client.send(new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: filePaths.map((Key) => ({ Key })) },
    }));
  } catch {
    // best-effort cleanup
  }
}

/** List files under a prefix in the bucket. */
export async function listFiles(prefix: string): Promise<Array<{ name: string; id: string }>> {
  if (!R2_ENDPOINT || !ACCESS_KEY_ID || !SECRET_KEY) return [];

  const client = getClient();
  try {
    const result = await client.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      MaxKeys: 200,
    }));
    return (result.Contents ?? []).map((obj) => ({
      name: obj.Key ?? '',
      id: obj.ETag ?? '',
    }));
  } catch {
    return [];
  }
}

/**
 * Create a presigned PUT URL so the browser can upload a file directly to R2
 * without routing the binary through the Next.js server.
 * Returns the URL the client should PUT to, plus the final public URL.
 */
export async function createSignedUploadUrl(filePath: string): Promise<{ uploadUrl: string; publicUrl: string }> {
  const client = getClient();

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: filePath,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });
  const publicUrl = getPublicUrl(filePath);
  return { uploadUrl, publicUrl };
}

/** Check if R2 storage is reachable. Returns true if healthy. */
export async function checkHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  if (!R2_ENDPOINT || !ACCESS_KEY_ID || !SECRET_KEY) return { ok: false, latencyMs: 0 };

  const client = getClient();
  const start = Date.now();
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
