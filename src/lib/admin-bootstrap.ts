// Seed an admin row on first run from env vars. Idempotent — runs only when
// the Admin table is empty. After first run, manage admins via the DB.

import 'server-only';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { log } from './logger';

let bootstrapped = false;

export async function ensureAdminBootstrap() {
  if (bootstrapped) return;
  bootstrapped = true;

  const count = await db.admin.count();
  if (count > 0) return;

  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const pass  = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !pass) {
    log.warn('admin.bootstrap_skipped', { reason: 'env vars missing' });
    return;
  }

  const passwordHash = await bcrypt.hash(pass, 12);
  await db.admin.create({ data: { email, passwordHash } });
  log.info('admin.bootstrapped', { email });
}
