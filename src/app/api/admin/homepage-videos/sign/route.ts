// POST /api/admin/homepage-videos/sign
// Returns a presigned upload URL so the browser can PUT the video
// directly to R2 — bypasses Next.js body size limits entirely.

import { withAdmin, ok, fail } from '@/lib/api';
import { createSignedUploadUrl } from '@/lib/storage';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TYPES: Record<string, string> = {
  'video/mp4':       'mp4',
  'video/quicktime': 'mov',
  'video/webm':      'webm',
  'video/mov':       'mov',
};

export const POST = withAdmin(async ({ req }) => {
  let body: { contentType: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON');
  }

  const contentType = body?.contentType?.toLowerCase().trim() ?? '';
  const ext = ALLOWED_TYPES[contentType];
  if (!ext) {
    return fail(400, 'File type not allowed. Allowed: MP4, MOV, WebM');
  }

  const filePath = `homepage/${randomUUID()}.${ext}`;
  const { uploadUrl, publicUrl } = await createSignedUploadUrl(filePath);

  return ok({ uploadUrl, publicUrl, filePath });
}, { permission: 'content' });
