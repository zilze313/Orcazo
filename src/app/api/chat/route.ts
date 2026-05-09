// GET  /api/chat  → creator: fetch their messages + mark incoming as read
// POST /api/chat  → creator: send a message

import { withEmployee, ok, parseBody, fail } from '@/lib/api';
import { db } from '@/lib/db';
import { limits } from '@/lib/ratelimit';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sendBody = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(2000),
});

export const GET = withEmployee(async ({ session }) => {
  const messages = await db.chatMessage.findMany({
    where: { employeeId: session.employeeId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      fromAdmin: true,
      content: true,
      readAt: true,
      createdAt: true,
    },
  });

  // Mark all unread admin messages as read (fire-and-forget)
  db.chatMessage.updateMany({
    where: {
      employeeId: session.employeeId,
      fromAdmin: true,
      readAt: null,
    },
    data: { readAt: new Date() },
  }).catch(() => {});

  return ok({ messages });
}, { rateLimit: limits.employee });

export const POST = withEmployee(async ({ req, session }) => {
  const parsed = await parseBody(req, sendBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const message = await db.chatMessage.create({
    data: {
      employeeId: session.employeeId,
      fromAdmin: false,
      content: parsed.data.content,
    },
    select: { id: true, fromAdmin: true, content: true, readAt: true, createdAt: true },
  });

  return ok({ message });
}, { rateLimit: limits.employee });
