# Deploying Orcazo

This guide is written for someone who has **never deployed a web app before**. Take it slow, follow each step in order, and don't skip — every step matters.

We're going to put three pieces in three different places:

| Piece                                  | Where it lives                    | Cost                                 |
| -------------------------------------- | --------------------------------- | ------------------------------------ |
| The website (Next.js code)             | **Vercel**                        | Free tier is enough to start         |
| The database (PostgreSQL)              | **Neon**                          | Free tier handles thousands of users |
| The domain name (e.g. `orcazo.com`) | **Namecheap / GoDaddy / Porkbun** | ~$10/year                            |

Total time: **about 45 minutes** if everything goes smoothly.

---

## Part 1 — Sign up for the three services

You'll need accounts on:

1. **GitHub** → https://github.com/signup (free) — this is where your code lives.
2. **Vercel** → https://vercel.com/signup (free) — sign up _with your GitHub account_. This auto-links them.
3. **Neon** → https://neon.tech/ (free) — sign up with GitHub for simplicity.
4. **A domain registrar** of your choice. I'll use **Namecheap** as the example. You should already own (or be about to buy) `orcazo.com` or whatever name you picked.

Do this first. Don't continue until all four accounts exist.

---

## Part 2 — Push your code to GitHub

If your project is already in GitHub, skip this section. Otherwise:

### 2.1 Create a new GitHub repo

1. Go to https://github.com/new
2. Repository name: `orcazo` (or whatever you want).
3. Make it **Private**.
4. Don't add a README, .gitignore, or license — your project already has them.
5. Click **Create repository**.

GitHub will show you a page with a list of commands. Look for the section titled **"…or push an existing repository from the command line"**.

### 2.2 Push your local project

Open a terminal in your project folder (the `web/` folder, where `package.json` lives) and run these commands one at a time:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/orcazo.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username. The first push may ask you to log in — follow the prompts.

After it finishes, refresh the GitHub repo page. You should see all your files there.

---

## Part 3 — Create the Neon database

Neon is a managed PostgreSQL host with a generous free tier and built-in connection pooling (which we need for many concurrent users).

1. Go to https://console.neon.tech/
2. Click **New Project**.
3. Project name: `orcazo`.
4. Postgres version: leave the default.
5. Region: pick the one **closest to your users**. If most are in the US East, pick `US East (Ohio)`. Match your Vercel region later.
6. Click **Create Project**.

Once it's created, you'll land on the project dashboard. Look for the **Connection string** box. Click the **dropdown next to "Direct connection"** and switch it to **"Pooled connection"** — this is critical for serverless apps like Vercel.

Copy the entire string. It looks like:

```
postgresql://user:password@ep-cool-name-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Save this somewhere — you'll need it in 5 minutes.** This is your `DATABASE_URL`.

You'll also want a separate "direct" (non-pooled) URL for migrations. Toggle the dropdown back to **"Direct connection"** and copy that too. It looks the same but without `-pooler` in the host. Save it as `DIRECT_DATABASE_URL`.

---

## Part 4 — Push the schema to your new database

We need to create the tables in your fresh Neon database.

In your terminal, in the `web/` folder, create a temporary `.env` file (call it `.env.production-setup`) with **only** this content:

```bash
DATABASE_URL="paste-the-DIRECT-url-here"
```

Then run:

```bash
npx dotenv -e .env.production-setup -- npx prisma db push
```

This connects to Neon and creates all the tables. You should see:

```
🚀  Your database is now in sync with your Prisma schema.
```

Now **delete the `.env.production-setup` file** — we used it once and don't need it on disk.

---

## Part 5 — Deploy to Vercel

This is where your website actually goes online.

### 5.1 Import the project

1. Go to https://vercel.com/new
2. You'll see a list of your GitHub repos. Click **Import** next to `orcazo`.
3. **Framework preset**: Vercel will detect Next.js automatically. Don't change it.
4. **Root Directory**: if your repo has the Next.js app inside a `web/` subfolder, click **Edit** and select `web`. Otherwise leave it as `./`.
5. **Build & Output Settings**: don't touch.
6. **Environment Variables**: this is where the rest of this part happens. Don't click Deploy yet.

### 5.2 Add environment variables

You need to add the following. Click **Add** for each one:

| Name                          | Value                              | Notes                                                   |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------- |
| `DATABASE_URL`                | the **pooled** Neon URL            | From Part 3                                             |
| `DIRECT_DATABASE_URL`         | the **direct** Neon URL            | Used for migrations                                     |
| `SESSION_SECRET`              | a long random string               | Generate with: `openssl rand -hex 32` in your terminal  |
| `ADMIN_BOOTSTRAP_EMAIL`       | the email you'll use as admin      | e.g. `admin@orcazo.com`                              |
| `ADMIN_BOOTSTRAP_PASSWORD`    | a strong password                  | Pick something you'll remember; you can change it later |
| `AFFILIATENETWORK_BASE_URL`   | `https://api.affiliatenetwork.com` | The upstream API                                        |
| `AFFILIATENETWORK_TIMEOUT_MS` | `15000`                            | 15 second timeout                                       |
| `NEXT_PUBLIC_APP_NAME`        | `Orcazo`                        | Shown in browser tab                                    |
| `NODE_ENV`                    | (do NOT add — Vercel sets it)      | —                                                       |

**Optional but recommended** (you can add these after the first deploy):

| Name                             | Value                               | Notes                                                                                                                                                  |
| -------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RESEND_API_KEY`                 | `re_xxx`                            | Sign up at https://resend.com (free 3k emails/month). Verify your domain, then paste the API key. Without this, rejection emails are silently skipped. |
| `EMAIL_FROM`                     | `Orcazo <noreply@orcazo.com>` | The "From" address. Must be on a domain you've verified in Resend.                                                                                     |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `0x4xxx`                            | Cloudflare Turnstile site key (public).                                                                                                                |
| `TURNSTILE_SECRET_KEY`           | `0x4xxx`                            | Cloudflare Turnstile secret key (server-only). Without these, signup forms still work but bots are unblocked.                                          |

**Resend setup (Q1 — chosen)**:

1. Go to https://resend.com/signup, sign up with your work email.
2. **Domains** → **Add Domain** → `orcazo.com` → Resend gives you DNS records (TXT + MX). Add them in Namecheap (Advanced DNS tab) → wait ~5 minutes for verification.
3. **API Keys** → **Create API Key** → name it "production" → copy the value into the `RESEND_API_KEY` env var on Vercel.

**Cloudflare Turnstile setup (Q4 — chosen)**:

1. Go to https://dash.cloudflare.com → **Turnstile** in the sidebar → **Add site**.
2. Name: `orcazo-prod`. Domain: `orcazo.com`. Widget mode: `Managed`.
3. Copy the **Site Key** to `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the **Secret Key** to `TURNSTILE_SECRET_KEY` in Vercel.

For `SESSION_SECRET`, in your terminal run `openssl rand -hex 32` and paste the output.

### 5.3 Deploy

Click the big **Deploy** button. Vercel will:

1. Pull your code from GitHub
2. Run `npm install`
3. Run `npm run build`
4. Deploy the result

The first build takes about 2–3 minutes. When it's done, you'll see a confetti animation and a URL like `orcazo-abc123.vercel.app`. Click it — your site is live!

### 5.4 Verify the basics

Visit your Vercel URL. You should see the login page. Don't try to log in yet — we need to do one more thing first.

Visit `https://YOUR-VERCEL-URL.vercel.app/api/health` — you should see something like `{"ok": true}`. If not, something is wrong with your env vars or DB connection. Check the **Deployments → click the latest → Logs** tab in Vercel to debug.

---

## Part 6 — Connect your custom domain

Now we point `orcazo.com` (or whatever you bought) at your Vercel deployment.

### 6.1 Add the domain in Vercel

1. In Vercel, go to your project → **Settings** → **Domains**.
2. Type `orcazo.com` and click **Add**.
3. Vercel will show you DNS records you need to set up. Keep this tab open.

You'll typically see two options:

- **Option A**: Add an `A record` pointing `@` to `76.76.21.21` (apex domain). And a `CNAME` for `www` pointing to `cname.vercel-dns.com`.
- **Option B**: Use Vercel's nameservers (replaces DNS at your registrar).

**Use Option A**. It's less invasive and easier to undo.

### 6.2 Update DNS at your registrar (Namecheap example)

1. Log in to Namecheap (or whichever registrar you used).
2. Go to **Domain List** → click **Manage** next to `orcazo.com`.
3. Click the **Advanced DNS** tab.
4. Delete the default `Parking` records that come pre-filled.
5. Add a new record:
   - Type: **A Record**
   - Host: `@`
   - Value: `76.76.21.21`
   - TTL: Automatic
6. Add another record:
   - Type: **CNAME Record**
   - Host: `www`
   - Value: `cname.vercel-dns.com.` (note the trailing dot)
   - TTL: Automatic
7. Save.

DNS changes can take **5 minutes to a few hours** to propagate. Be patient.

### 6.3 Wait for Vercel to verify

Go back to the Vercel **Domains** tab. You'll see your domain with a **"Configuring"** or **"Pending"** status. After DNS propagates, it'll switch to **"Valid Configuration"** with a green checkmark. Vercel auto-issues a free SSL cert.

Once green, visit `https://orcazo.com`. You're live with your real domain!

---

## Part 7 — First admin login & onboarding

1. Go to `https://orcazo.com/admin/login`
2. Log in with the `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD` you set in step 5.2.
3. You'll land on the admin dashboard. Click **Allowlist** in the sidebar.
4. Add the email of every employee who should be able to use Orcazo. Click **Add** for each.
5. Tell each employee to go to `https://orcazo.com/login` and enter their email. They'll get a verification code at _your admin AffiliateNetwork inbox_ — relay it to them.

That's it. You're operational.

---

## Part 8 — Day-to-day operations

### Updating the code

Whenever you push a commit to GitHub's `main` branch, Vercel will automatically rebuild and deploy in about 2 minutes. No manual step needed.

```bash
# After making code changes locally:
git add .
git commit -m "Describe your change"
git push
```

### Updating the database schema

If you change `prisma/schema.prisma` locally, you need to apply the change to your production Neon database too:

```bash
# Set up a temporary env file with the DIRECT (non-pooled) Neon URL
echo 'DATABASE_URL="paste-direct-url"' > .env.production-setup
npx dotenv -e .env.production-setup -- npx prisma db push
rm .env.production-setup
```

### Looking at logs

In Vercel: **Deployments → click any deployment → Functions** tab.
In Neon: **Project → Monitoring** tab.

### Backups

Neon automatically takes hourly backups on the free tier. To restore: **Project → Branches → Restore from history**.

---

## Troubleshooting

**"Internal server error" when logging in**
Check Vercel logs (Deployments → latest → Functions). 99% of the time it's a missing or wrong env var. Most common: `DATABASE_URL` not set, or pointing to the non-pooled URL when it should be pooled.

**"This email is not authorized to access Orcazo"**
That email isn't in the allowlist. Add it via `/admin/allowlist`.

**Blank page or "Application error"**
Check the browser's DevTools Console and the Vercel Function logs. Often a missing env var.

**Verification email never arrives**
That email goes to **your admin AffiliateNetwork inbox** — not the user's inbox. Check there. The whole point of Orcazo is that the user never sees AffiliateNetwork branding, so the OTP relay is manual.

**Slow first page load**
Vercel "cold starts" serverless functions on idle. The first request after a quiet period takes ~1 second extra. After that, it's fast.

---

## Scaling beyond 1,000 users

The architecture is designed to handle ~1k concurrent users on the free tier:

- **Neon** free tier: 0.25 CPU, autosuspend after 5 min idle, 3 GB storage. Plenty for ~1k active users. Upgrade to Launch tier ($19/mo) when you exceed it.
- **Vercel** free tier: 100 GB bandwidth, unlimited function executions. The Pro tier ($20/mo) bumps this and removes some limits.
- **In-memory cache** (campaigns, sessions): per Vercel function instance. Each cold start re-hits AffiliateNetwork once. If you outgrow this (very unlikely under 1k users), swap `src/lib/cache.ts` to a Redis-backed implementation — the function signature is unchanged so call sites don't need updates.
- **In-memory rate limiting**: same caveat. Swap to Redis (Upstash works with Vercel) if you need cross-instance limiting.

You don't need any of these upgrades on day 1.

---

## Renewals

- **Domain**: ~$10/year, auto-renew on at your registrar so you don't lose it.
- **Vercel**: free until you exceed limits.
- **Neon**: free until you exceed limits.
- **AffiliateNetwork accounts**: managed manually.

---

That's the whole guide. If you get stuck on any specific step, the most useful thing is to **screenshot the exact error and the screen you're on**, then come back and ask.
