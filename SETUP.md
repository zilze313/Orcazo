# Orcazo — local setup

For production deployment, see **DEPLOYMENT.md** instead.

## 1. Postgres (local dev)

```bash
docker run -d --name orcazo-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=orcazo postgres:16
```

## 2. Env

```bash
cp .env.example .env
# Edit .env. At minimum, generate SESSION_SECRET:
#   openssl rand -hex 32
```

## 3. Install + DB schema

```bash
npm install
npm run db:generate
npm run db:push
```

## 4. Run

```bash
npm run dev
# http://localhost:3000
```

The first time the app runs, an admin row is seeded from `ADMIN_BOOTSTRAP_EMAIL` /
`ADMIN_BOOTSTRAP_PASSWORD`. Visit `/admin/login` and sign in to manage the allowlist.

## 5. Onboard your first creator

1. Go to `/admin/login`, sign in with the bootstrap admin credentials.
2. Open **Allowlist** → add the creator's email.
3. Tell the creator to go to `/login` and enter their email.
4. The OTP arrives at the AffiliateNetwork inbox you've registered for that creator.
   Relay it to them. They enter it on `/login` step 2 → they're in.

## What's wired up

- ✅ Email allowlist (enforced before any upstream call)
- ✅ Email-OTP login flow proxied to AffiliateNetwork
- ✅ Cookie capture during verify-code so `/fetch-user` works server-side
- ✅ DB-backed sessions; cookie holds only an opaque session id, never the upstream token
- ✅ Per-user, single-flight, cached upstream client with retry-on-transient
- ✅ Per-IP and per-user rate limits (token bucket)
- ✅ 50% commission applied to every monetary value before delivery
- ✅ Campaign card with favorite, RPM, approval rate, per-platform detail modal, rules dialog
- ✅ Per-social Apply flow when `applyMode.on === true`; direct Submit otherwise
- ✅ Dashboard with sortable earnings/views/posted/submitted columns
- ✅ Admin panel: dashboard stats, allowlist (search + paginate), employees (sort + search + paginate), submissions (filter + search + paginate)
- ✅ Global error boundary
