// POST /api/admin/custom-campaigns/sign-upload
// Returns a Supabase signed upload URL so the browser can PUT the campaign
// icon directly (bypasses Next.js body size limits, no proxy bandwidth cost).

import { withAdmin, ok, fail } from '@/lib/api';
import { createSignedUploadUrl } from '@/lib/supabase';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TYPES: Record<string, string> = {
  'image/png':  'png',
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/webp': 'webp',
  'image/gif':  'gif',
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
    return fail(400, 'File type not allowed. Allowed: PNG, JPG, WebP, GIF');
  }

  const filePath = `custom-campaigns/${randomUUID()}.${ext}`;
  const { uploadUrl, publicUrl } = await createSignedUploadUrl(filePath);

  return ok({ uploadUrl, publicUrl, filePath });
}, { permission: 'campaigns' });
