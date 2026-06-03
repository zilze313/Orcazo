import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
const url = process.env.DIRECT_DATABASE_URL;   // bypass the flaky pooler
const [bare,q]=url.split('?'); const p=new URLSearchParams(q??''); p.set('connect_timeout','30');
const finalUrl=`${bare}?${p.toString()}`;
async function withRetry(fn, tries=15){
  let last;
  for(let i=0;i<tries;i++){
    const db=new PrismaClient({datasources:{db:{url:finalUrl}}});
    try{ const r=await fn(db); await db.$disconnect(); return r; }
    catch(e){ last=e; await db.$disconnect(); await new Promise(r=>setTimeout(r,2000)); }
  }
  throw last;
}
const out=[];
try {
  await withRetry(db=>db.$executeRawUnsafe(`ALTER TABLE "Allowlist" ADD COLUMN IF NOT EXISTS "reclaimWarningSentAt" TIMESTAMP(3)`));
  out.push('alter: ok');
  const cols = await withRetry(db=>db.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='Allowlist'`));
  out.push('has_column_now: '+cols.map(c=>c.column_name).includes('reclaimWarningSentAt'));
  const full = await withRetry(db=>db.allowlist.findMany({ orderBy:{createdAt:'desc'}, take:50 }));
  out.push('full_findMany_rows: '+full.length);
} catch(e){ out.push('ERROR: '+(e.message||'').split('\n').slice(0,5).join(' || ')); }
writeFileSync('./_fix2.txt', out.join('\n')+'\nDONE');
