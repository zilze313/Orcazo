// GET /api/public/homepage-videos
// Returns active homepage carousel videos. Public endpoint — no auth required.

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const videos = await db.homepageVideo.findMany({
    where: { active: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    select: { id: true, url: true, title: true, order: true },
  });
  return NextResponse.json({ videos });
}
