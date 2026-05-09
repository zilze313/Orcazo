// GET  /api/admin/messages/[employeeId]  → fetch conversation + mark as read
// POST /api/admin/messages/[employeeId]  → admin sends a message

import { withAdmin, ok, parseBody, fail } from '@/lib/api';
import { db } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sendBody = z.object({
  content: z.string().trim().min(1).max(2000),
});

export const GET = withAdmin(async ({ req }) => {
  const employeeId = req.url.split('/').at(-1)!;

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  if (!employee) return fail(404, 'Employee not found.', 'NOT_FOUND');

  const messages = await db.chatMessage.findMany({
    where: { employeeId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, fromAdmin: true, content: true, readAt: true, createdAt: true },
  });

  // Mark all unread creator messages as read (fire-and-forget)
  db.chatMessage.updateMany({
    where: { employeeId, fromAdmin: false, readAt: null },
    data: { readAt: new Date() },
  }).catch(() => {});

  return ok({
    employee: {
      id: employee.id,
      email: employee.email,
      displayName: employee.firstName
        ? `${employee.firstName}${employee.lastName ? ' ' + employee.lastName : ''}`
        : employee.email,
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

  const message = await db.chatMessage.create({
    data: { employeeId, fromAdmin: true, content: parsed.data.content },
    select: { id: true, fromAdmin: true, content: true, readAt: true, createdAt: true },
  });

  return ok({ message });
});
