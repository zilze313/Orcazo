// POST /api/admin/messages/[employeeId]/upload
// Admin uploads an image to R2 Storage for support chat.

import { NextRequest } from 'next/server';
import { withAdmin, fail, ok } from '@/lib/api';
import { uploadFile } from '@/lib/storage';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export const POST = withAdmin(async ({ req }) => {
  const employeeId = req.url.split('/').at(-2)!;

  const formData = await req.formData().catch(() => null);
  if (!formData) return fail(400, 'Invalid form data', 'BAD_REQUEST');

  const file = formData.get('file');
  if (!file || typeof file === 'string') return fail(400, 'No file provided', 'NO_FILE');

  if (!ALLOWED_TYPES.has(file.type)) {
    return fail(400, 'File type not allowed. Allowed: JPEG, PNG, GIF, WebP', 'INVALID_TYPE');
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return fail(413, 'File too large (max 50 MB)', 'TOO_LARGE');
  }

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const filePath = `chat/${employeeId}/admin-${randomUUID()}.${ext}`;

  const { url } = await uploadFile({
    filePath,
    body: Buffer.from(bytes),
    contentType: file.type,
  });

  return ok({ url, mediaType: file.type });
});
