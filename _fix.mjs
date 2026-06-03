import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
const url = process.env.DATABASE_URL;
const [bare,q]=url.split('?'); const p=new URLSearchParams(q??''); p.set('connect_timeout','25'); p.set('pool_timeout','25');
const finalUrl=`${bare}?${p.toString()}`;
async function withRetry(fn, tries=12){
  let last;
  for(let i=0;i<tries;i++){
    const db=new PrismaClient({datasources:{db:{url:finalUrl}}});
    try{ const r=await fn(db); await db.$disconnect(); return r; }
    catch(e){ last=e; await db.$disconnect(); await new Promise(r=>setTimeout(r,2500)); }
  }
  throw last;
}
const out=[];
try {
  // 1) columns before
  const before = await withRetry(db=>db.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='Allowlist'`));
  const had = before.map(c=>c.column_name).includes('reclaimWarningSentAt');
  out.push('had_column_before: '+had);
  // 2) idempotent add
  await withRetry(db=>db.$executeRawUnsafe(`ALTER TABLE "Allowlist" ADD COLUMN IF NOT EXISTS "reclaimWarningSentAt" TIMESTAMP(3)`));
  out.push('alter_ran: ok');
  // 3) confirm full findMany (the exact route query) works now
  const full = await withRetry(db=>db.allowlist.findMany({ orderBy:{createdAt:'desc'}, take:50 }));
  out.push('full_findMany_rows: '+full.length);
} catch(e){ out.push('ERROR: '+(e.message||'').split('\n').slice(0,5).join(' || ')); }
writeFileSync('./_fix.txt', out.join('\n')+'\nDONE');
