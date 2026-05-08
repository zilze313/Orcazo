// GET /api/me
// Returns the current employee + their AffiliateNetwork profile.
// Upstream is the source of truth, but we cache key fields (especially
// bioVerificationCode) on the Employee row at login time. If upstream returns
// empty/incomplete data on this call (which happens — see notes), we fall back
// to the DB so the UI never flashes "your account isn't set up yet" for an
// account that *is* set up upstream.
//
// We also opportunistically refresh the DB cache when upstream gives us fresh
// data, so the admin views stay current.

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { getEmployeeSession } from "@/lib/session";
import { fetchUser } from "@/lib/affiliatenetwork/client";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await getEmployeeSession();
  if (!session) return fail(401, "Not authenticated");

  // 1) Always read DB record — we'll use it as fallback if upstream is empty
  const employee = await db.employee.findUnique({
    where: { id: session.employeeId },
    select: {
      affiliateNetworkPublicId: true,
      firstName: true,
      lastName: true,
      bioVerificationCode: true,
      cachedBalance: true,
      lastSyncedAt: true,
    },
  });

  // 2) Try upstream — pass the captured cookies. AffiliateNetwork's
  //    /fetch-user ignores the token field and authenticates by cookie.
  //    Without cookies (e.g. for accounts that logged in before cookie
  //    capture was added), the response will be `{ user: { token: "" } }`
  //    and we'll fall back to the DB.
  let upstream = (
    await fetchUser(
      session.affiliateNetworkToken,
      session.affiliateNetworkCookies,
    ).catch(() => null)
  )?.user;

  if (!upstream || !upstream.bioVerificationCode) {
    upstream = (
      await fetchUser(
        session.affiliateNetworkToken,
        session.affiliateNetworkCookies,
        { bypass: true },
      ).catch(() => null)
    )?.user;
  }

  // Detect "empty" upstream response: a token-only object with nothing else
  // populated. Treat as "no fresh data" and fall back to DB.
  const upstreamIsEmpty = !upstream || !upstream.bioVerificationCode;

  // 3) If upstream gave us fresh useful data AND it's different from DB, update
  //    the cache. Fire-and-forget — never block the response.
  if (upstream && !upstreamIsEmpty) {
    const fresh = {
      affiliateNetworkPublicId: upstream.publicId ?? undefined,
      firstName: upstream.personal?.firstName ?? undefined,
      lastName: upstream.personal?.lastName ?? undefined,
      bioVerificationCode: upstream.bioVerificationCode ?? undefined,
      cachedBalance: upstream.balance
        ? new Prisma.Decimal(upstream.balance)
        : undefined,
      lastSyncedAt: new Date(),
    };
    db.employee
      .update({ where: { id: session.employeeId }, data: fresh })
      .catch((err) => log.warn("me.refresh_db_failed", { err: String(err) }));
  }

  // 4) Compose the profile we return. Strip the upstream token NO MATTER WHAT.
  const profile =
    upstream && !upstreamIsEmpty
      ? (() => {
          const { token: _stripped, ...rest } = upstream;
          return rest;
        })()
      : {
          publicId: employee?.affiliateNetworkPublicId ?? null,
          bioVerificationCode: employee?.bioVerificationCode ?? null,
          personal: {
            email: session.email,
            firstName: employee?.firstName ?? null,
            lastName: employee?.lastName ?? null,
          },
          balance: employee?.cachedBalance?.toString() ?? "0",
        };

  return ok({
    email: session.email,
    profile,
    // Hint to the UI that the profile shown came from our cache, not live upstream
    profileFresh: !upstreamIsEmpty,
  });
}
