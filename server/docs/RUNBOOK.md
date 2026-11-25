# Operations runbook

How to put the MANI DEVELOPMENT website live and keep it running. Written 2026-11-21.
Hosting choices and prices: INTEGRATIONS.md §4–7. Order of work: BACKEND_MASTER_PLAN.md Phases 3, 10 and 16.

**Golden rule for secrets:** passwords, app passwords, API tokens and database addresses are typed
only into the Render or Vercel dashboard (or your own `server/.env`). Never into Git, chat or email.

---

## 1. What runs where

| Part | Service | Address |
|---|---|---|
| Website + admin panel | Vercel (Pro), project root `client/` | `www.manidevelopment.ge` |
| API | Render web service `mani-api`, Frankfurt, `0.5c-512mb` | `api.manidevelopment.ge` |
| Database | Render Postgres `mani-db`, Frankfurt, `0.1c-256mb`, PostgreSQL 18 | private (Render network only) |
| Photos | Cloudflare Images | `imagedelivery.net/...` |
| Email | Google Workspace Gmail SMTP, sending as `info@manidevelopment.ge` | — |
| Domain | Amazon Route 53 (zone owner: Q-28) | — |

Both addresses must be on `manidevelopment.ge`: Safari refuses the sign-in cookie between
`vercel.app` and `onrender.com`.

---

## 2. First-time setup

### 2.1 Accounts (you)
1. **Render:** create the account, add a payment method, connect the GitHub repository.
2. **Vercel:** create a Pro team, connect the GitHub repository.
3. **Cloudflare:** enable **Images** (paid). Create an API token with *Account → Cloudflare Images → Edit* only.
   Note the Account ID and the Images *account hash* (Images → Overview → "Account hash").
   In Images → Variants, switch on **flexible variants**.
4. **Google Workspace:** on `info@manidevelopment.ge` turn on 2-Step Verification, then create an
   **app password** (Google Account → Security → App passwords). Keep the browser tab open until it is pasted into Render.

### 2.2 API and database (Render Blueprint)
1. Merge the work into `main` (the Blueprint deploys `main`).
2. Render → **New → Blueprint** → choose the repository. Render reads `render.yaml` and shows `mani-api` and `mani-db`.
3. It asks for the secret values (`sync: false`):
   - `TRUST_PROXY_HOPS`: `1` to start (Render's proxy). Measured on staging before launch (R-07).
   - `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_IMAGES_API_TOKEN`, `CLOUDFLARE_IMAGES_ACCOUNT_HASH`
   - `SMTP_APP_PASSWORD`: the Google app password
4. Apply. Render builds, runs the database migrations (`preDeployCommand`), then starts the API.
   It only switches traffic once `GET /api/health/ready` answers 200.
5. **Create the admin account** (Render → `mani-api` → Shell):
   ```
   npm run admin:create
   ```
   It asks for the email (`dev@manidevelopment.ge`), name and password in the terminal. The password is never shown or logged.

### 2.3 Website (Vercel)
1. Vercel → **Add New → Project** → the repository → **Root Directory: `client`**.
2. Environment variables (Production):
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://api.manidevelopment.ge` |
   | `NEXT_PUBLIC_SITE_URL` | `https://www.manidevelopment.ge` |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | only if Turnstile is used (§6.3) |
   Staging only: `SITE_NOINDEX=1` (keeps it out of Google).
3. Deploy.

### 2.4 DNS (Route 53)
| Record | Type | Value |
|---|---|---|
| `www.manidevelopment.ge` | CNAME | the target Vercel shows under Project → Domains |
| `manidevelopment.ge` | A / ALIAS | Vercel's apex value; set Vercel to redirect it to `www` |
| `api.manidevelopment.ge` | CNAME | the `onrender.com` address Render shows under Settings → Custom Domains |
| DKIM | TXT | from Google Admin → Apps → Gmail → Authenticate email (needs the Workspace super admin) |
| `_dmarc.manidevelopment.ge` | TXT | `v=DMARC1; p=none; rua=mailto:info@manidevelopment.ge` |

SPF already exists; check it includes `include:_spf.google.com` before changing anything.

---

## 3. Go-live checklist

Tick each with evidence (a screenshot or the command output).

- [ ] `curl -I https://api.manidevelopment.ge/api/health/ready` → `200`
- [ ] `curl -I https://www.manidevelopment.ge` → `200`, **no** `X-Robots-Tag: noindex`
- [ ] Sign in to `/admin` in Safari, Chrome and Firefox
- [ ] Upload a photo, use it in a project, publish, see it on the public site in both languages
- [ ] Flexible variants work: `curl -I https://imagedelivery.net/<account hash>/<image id>/w=640,q=80` → `200` (the site asks for sized copies; without this every uploaded photo falls back to its full-size original)
- [ ] Rename a published project's address → the old address answers `308` to the new one
- [ ] An unknown address answers `404`
- [ ] Send the contact form → the inquiry appears in the admin inbox **and** the email arrives at `info@`
- [ ] The email's "Show original" says **SPF: PASS** and **DKIM: PASS**
- [ ] "Forgot password?" → the email arrives → the link works once only
- [ ] Settings: WhatsApp, Messenger, phone and map buttons open the right targets
- [ ] Search Console: property verified (token in Settings), `https://www.manidevelopment.ge/sitemap.xml` submitted
- [ ] Analytics (if a Tag Manager ID is set): nothing loads before consent; after Accept, one `page_view`, one `contact_click`, one `generate_lead`
- [ ] Restore drill done (§5.4)
- [ ] Uptime monitor on `/api/health/ready` and the homepage

---

## 4. Everyday operations

### 4.1 Deploying
Merging into `main` deploys both: Vercel builds the website, Render builds the API and runs migrations first.
Check afterwards: Render → Events shows "Deploy live"; Vercel → Deployments shows "Ready".

### 4.2 Rolling back
- **Website:** Vercel → Deployments → previous one → **Instant Rollback**.
- **API:** Render → `mani-api` → Events → previous deploy → **Rollback**.
- **Database changes are forward-only.** A rollback returns the code, not the data shape, so every
  migration is written to be safe for the previous code version (add columns before using them; drop later).

### 4.3 A migration failed during deploy
The deploy stops and the old version keeps running (nothing is broken for visitors).
1. Render → the failed deploy → logs: read the Prisma error.
2. Fix the migration in a new commit (never edit a migration that already ran anywhere).
3. If Prisma marked it failed: Render Shell → `npx prisma migrate resolve --rolled-back <migration_name>`, then redeploy.

### 4.4 Admin forgot the password
Use "Forgot password?" on the sign-in page. If email is down: Render Shell → `npm run admin:set-password`.

---

## 5. Secrets and data

### 5.1 Gmail app password stopped working
Symptom: the API log says *"SMTP sign-in refused: check the Gmail app password"*. Inquiries are still saved
and their emails wait in the queue (retried after 1, 5, 30 and 120 minutes, then marked failed).
Google cancels app passwords when the account's password changes.
1. Create a new app password for `info@`.
2. Render → `mani-api` → Environment → `SMTP_APP_PASSWORD` → paste → Save (Render redeploys).
3. Emails still queued are sent automatically. Ones already marked `failed` can be found in the
   `email_messages` table (status `failed`); set them back to `pending` to resend:
   `UPDATE email_messages SET status='pending', next_attempt_at=now() WHERE status='failed';`

### 5.2 Rotating the Cloudflare token
Create the new token → paste into Render → Save → delete the old token in Cloudflare.

### 5.3 Backups
Render Postgres (paid) keeps point-in-time recovery for 3 days (Hobby workspace) or 7 days (Pro).

### 5.4 Restore drill (before launch, then twice a year)
1. Render → `mani-db` → Recovery → restore to a **new** database at a chosen time.
2. Check it: open its shell and run `SELECT count(*) FROM projects;`.
3. Delete the restored copy. Never point `mani-api` at it unless the real database is lost.

---

## 6. Optional features

### 6.1 Analytics (Google Tag Manager + GA4)
Paste the container ID (`GTM-…`) in Admin → Settings. Empty = analytics off, no deploy needed.
In Tag Manager: a Google tag with the GA4 measurement ID; Custom Event triggers `contact_click` and
`generate_lead`; a GA4 Event tag for each; in GA4 mark both as key events. Tags load only after the visitor accepts.

### 6.2 Search Console
Add the URL-prefix property `https://www.manidevelopment.ge/`, choose "HTML tag", paste only the
`content` value into Admin → Settings → Google verification, then press Verify and submit the sitemap.

### 6.3 Contact-form spam check (Cloudflare Turnstile)
Only if spam arrives despite the hidden trap field and rate limits (5 per hour, 20 per day per address).
Cloudflare → Turnstile → add the site → put the **site key** in Vercel (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`)
and the **secret key** in Render (`TURNSTILE_SECRET_KEY`).
