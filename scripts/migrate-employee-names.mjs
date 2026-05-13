/**
 * One-time migration: backfill Employee.firstName / lastName from
 * CreatorSignupRequest.fullName for all existing employees.
 *
 * Run from the project root:
 *   node --env-file=.env scripts/migrate-employee-names.mjs
 *
 * Safe to re-run — employees whose CreatorSignupRequest is missing are skipped.
 * Employees that already have a name populated are still updated (fullName wins).
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function parseName(fullName) {
  const trimmed = fullName.trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx > 0) {
    return {
      firstName: trimmed.slice(0, spaceIdx),
      lastName:  trimmed.slice(spaceIdx + 1).trim() || null,
    };
  }
  return { firstName: trimmed, lastName: null };
}

async function main() {
  const employees = await db.employee.findMany({
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  console.log(`Found ${employees.length} employees.`);

  let updated = 0;
  let skipped = 0;

  for (const emp of employees) {
    const req = await db.creatorSignupRequest.findUnique({
      where:  { publicEmail: emp.email },
      select: { fullName: true },
    });

    if (!req?.fullName) {
      console.log(`  SKIP  ${emp.email} — no signup request found`);
      skipped++;
      continue;
    }

    const { firstName, lastName } = parseName(req.fullName);

    await db.employee.update({
      where: { id: emp.id },
      data:  { firstName, lastName },
    });

    console.log(`  OK    ${emp.email} → "${firstName}${lastName ? ' ' + lastName : ''}"`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
