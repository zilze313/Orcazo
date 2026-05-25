// GET  /api/admin/admins  → list all admins (SUPER_ADMIN only)
// POST /api/admin/admins  → create a new admin (SUPER_ADMIN only)

import { withAdmin, ok, parseBody, fail } from '@/lib/api';
import { db } from '@/lib/db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALL_PERMISSIONS = [
  'campaigns',
  'creators',
  'messages',
  'payouts',
  'content',
  'login-requests',
  'managed-emails',
  'referral-codes',
  'health',
] as const;

const createBody = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN']).default('ADMIN'),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).default([]),
});

export const GET = withAdmin(async () => {
  const admins = await db.admin.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      permissions: true,
      createdAt: true,
      _count: { select: { sessions: { where: { expiresAt: { gt: new Date() } } } } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return ok({ admins });
}, { permission: 'admins' });

export const POST = withAdmin(async ({ req, session }) => {
  if (session.role !== 'SUPER_ADMIN') {
    return fail(403, 'Only SUPER_ADMIN can create admins', 'FORBIDDEN');
  }

  const parsed = await parseBody(req, createBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const { email, password, role, permissions } = parsed.data;

  const existing = await db.admin.findUnique({ where: { email } });
  if (existing) return fail(409, 'An admin with that email already exists', 'CONFLICT');

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await db.admin.create({
    data: {
      email,
      passwordHash,
      role,
      permissions: role === 'SUPER_ADMIN' ? [] : permissions,
    },
    select: { id: true, email: true, role: true, permissions: true, createdAt: true },
  });

  return ok({ admin });
}, { permission: 'admins' });
