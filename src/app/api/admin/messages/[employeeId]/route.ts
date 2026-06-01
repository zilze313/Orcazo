// GET  /api/admin/messages/[employeeId]  → fetch conversation + mark as read
// POST /api/admin/messages/[employeeId]  → admin sends a message

import { withAdmin, ok, parseBody, fail } from '@/lib/api';
import { db } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sendBody = z.object({
  content: z.string().trim().min(1).max(2000),
  mediaUrl: z.string().url().optional(),
  mediaType: z.string().max(100).optional(),
});

export const GET = withAdmin(async ({ req }) => {
  const employeeId = req.url.split('/').at(-1)!;

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  if (!employee) return fail(404, 'Employee not found.', 'NOT_FOUND');

  const [messages, signupReq] = await Promise.all([
    db.chatMessage.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, fromAdmin: true, content: true, mediaUrl: true, mediaType: true, readAt: true, createdAt: true },
    }),
    // Prefer the name the creator entered during signup over AffiliateNetwork names
    db.creatorSignupRequest.findUnique({
      where: { publicEmail: employee.email },
      select: { fullName: true },
    }),
  ]);

  // Mark all unread creator messages as read (fire-and-forget)
  db.chatMessage.updateMany({
    where: { employeeId, fromAdmin: false, readAt: null },
    data: { readAt: new Date() },
  }).catch(() => {});

  const afName = employee.firstName
    ? `${employee.firstName}${employee.lastName ? ' ' + employee.lastName : ''}`
    : null;

  return ok({
    employee: {
      id: employee.id,
      email: employee.email,
      displayName: signupReq?.fullName ?? afName ?? employee.email,
    },
    messages,
  });
});

export const POST = withAdmin(async ({ req }) => {
  const employeeId = req.url.split('/').at(-1)!;

  const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) return fail(404, 'Employee not found.', 'NOT_FOUND');

  const parsed = await parseBody(req, sendBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  // Schedule the "you have an unread message" email 5 minutes from now.
  // The cron at /api/cron/notify-unread-chat picks it up if readAt is still null.
  const notifyEmailAt = new Date(Date.now() + 5 * 60 * 1000);

  const message = await db.chatMessage.create({
    data: {
      employeeId,
      fromAdmin: true,
      content: parsed.data.content,
      mediaUrl: parsed.data.mediaUrl ?? null,
      mediaType: parsed.data.mediaType ?? null,
      notifyEmailAt,
    },
    select: { id: true, fromAdmin: true, content: true, mediaUrl: true, mediaType: true, readAt: true, createdAt: true },
  });

  return ok({ message });
});
