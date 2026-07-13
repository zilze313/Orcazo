// POST /api/chat/upload
// Creator uploads an image to R2 Storage for support chat.
// Returns: { url, mediaType }
// Max file size: 50 MB. Allowed types: image/jpeg, image/png, image/gif, image/webp.

import { withEmployee, fail, ok } from '@/lib/api';
import { uploadFile } from '@/lib/storage';
import { limits } from '@/lib/ratelimit';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export const POST = withEmployee(async ({ req, session }) => {
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
  const filePath = `chat/${session.employeeId}/${randomUUID()}.${ext}`;

  const { url } = await uploadFile({
    filePath,
    body: Buffer.from(bytes),
    contentType: file.type,
  });

  return ok({ url, mediaType: file.type });
}, { rateLimit: limits.employee });
