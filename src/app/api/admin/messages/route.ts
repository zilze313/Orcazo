// GET /api/admin/messages
// Returns all conversations: one entry per employee who has at least one
// message, sorted by most-recent message desc.

import { withAdmin, ok } from '@/lib/api';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => {
  // All employees that have at least one message
  const employees = await db.employee.findMany({
    where: { messages: { some: {} } },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true, createdAt: true, fromAdmin: true },
      },
    },
  });

  // Prefer the name the creator entered during signup over AffiliateNetwork names
  const emails = employees.map((e) => e.email);
  const [unread, signupRequests] = await Promise.all([
    db.chatMessage.groupBy({
      by: ['employeeId'],
      _count: { id: true },
      where: { fromAdmin: false, readAt: null },
    }),
    db.creatorSignupRequest.findMany({
      where: { publicEmail: { in: emails } },
      select: { publicEmail: true, fullName: true },
    }),
  ]);

  const unreadMap   = new Map(unread.map((r) => [r.employeeId, r._count.id]));
  const signupNames = new Map(signupRequests.map((r) => [r.publicEmail, r.fullName]));

  const conversations = employees
    .filter((e) => e.messages.length > 0)
    .map((e) => {
      const signupName = signupNames.get(e.email);
      const afName = e.firstName ? `${e.firstName}${e.lastName ? ' ' + e.lastName : ''}` : null;
      return {
        employeeId:    e.id,
        email:         e.email,
        displayName:   signupName ?? afName ?? e.email,
        lastMessage:   e.messages[0].content.slice(0, 80),
        lastAt:        e.messages[0].createdAt,
        lastFromAdmin: e.messages[0].fromAdmin,
        unreadCount:   unreadMap.get(e.id) ?? 0,
      };
    })
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

  return ok({ conversations });
});
