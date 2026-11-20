# External Integrations

**Status:** PROPOSED, except where marked VERIFIED or decided.

**How the documentation was checked:** official pages were fetched on **2026-11-20** by research sub-agents working from this planning session. Every fact below cites its source URL. The fetch tool summarizes pages, so quoted wording may be lightly paraphrased. Re-open a URL before relying on exact phrasing (for example in a contract or a cost approval). Facts the sources did not confirm are marked **NOT VERIFIED**.

---

## 1. Media storage: Cloudflare (Q-04)

### 1.1 What the frontend needs (from the audit, F-09)

- **Images only, today.** There is no video anywhere in the current code. Video is now a client requirement and is designed in §11.
- **Volume:** tens to low hundreds of images (38 in the seed). Uploaded by a few admins; viewed by the public.
- **Display:**
  - Responsive sizes in many layouts: `sizes` attributes from 44 px thumbnails to `100vw` heroes (`client/components/ui/Img.tsx` and its callers).
  - AVIF/WebP delivery. Today `next.config.ts` sets `formats: ["image/avif", "image/webp"]` and `qualities: [70, 80]`.
- **Upload limit:** the current UI accepts up to 15 MB per file (`MediaAdmin.tsx:17`).

### 1.2 Products compared (verified facts)

| | **Cloudflare Images** | **R2 (+ Image Transformations)** | **Stream** |
|---|---|---|---|
| Purpose | Store, resize and deliver images | General object storage; resizing is a separate zone feature | Video encoding and playback |
| Browser upload | **Direct Creator Upload.** The server requests a one-time URL; the browser POSTs `multipart/form-data` with field `file`. Default expiry 30 min, configurable from 2 min to 6 h. [docs][img-dcu] | **Presigned PUT** (GET/HEAD/PUT/DELETE supported; **presigned POST not supported**). Content-Type can be pinned; enforcing a maximum Content-Length on a presigned PUT is **NOT VERIFIED**. Needs a bucket CORS policy. [docs][r2-presign] [cors][r2-cors] | Direct creator upload: basic POST up to **200 MB**, tus above that; `maxDurationSeconds` is required. [docs][stream-dcu] |
| Validates the file is really an image? | Yes. Accepts PNG, JPEG, GIF, WebP, SVG (sanitized) and HEIC. AVIF input is Enterprise-only. Max **10 MB**, 100 MP, 12,000 px. [limits][img-limits] | **No.** R2 stores any bytes. The server would have to check size and file signature after upload. | Video formats (MP4, MOV, WebM, …) under 30 GB. [docs][stream-formats] |
| Delivery and resizing | `imagedelivery.net/<hash>/<id>/<variant>`, up to 100 named variants, or **flexible variants** (`/w=400,…`). Automatic AVIF/WebP. A custom domain works if the domain is on Cloudflare in the same account. [variants][img-variants] [flexible][img-flex] [serve][img-serve] | Public access needs a **custom domain on a Cloudflare zone**; `r2.dev` "is rate-limited and should only be used for development purposes". Resizing via `/cdn-cgi/image/…` also needs the zone on Cloudflare with the feature enabled. [public][r2-public] [transform][img-transform] | HLS/DASH manifests or the Stream Player iframe. [docs][stream-play] |
| Metadata returned | id, filename, `meta` (≤ 1 KB), `uploaded`, variants. **No width or height.** The docs disagree on whether a `draft` flag appears in image details. [api][img-get] | Object size and content type via HEAD | — |
| Delete | `DELETE …/images/v1/{id}` [docs][img-delete] | DeleteObject (free operation) | `DELETE …/stream/{id}` |
| Price | Storage **only on Images Paid**: **$5 per 100,000 images stored per month**, **$1 per 100,000 delivered**. [pricing][img-pricing] | Storage $0.015/GB-month (**10 GB free**); Class A $4.50/M (1M free); Class B $0.36/M (10M free); **egress free**. Transformations: **5,000 unique per month free**, then $0.50 per 1,000. [r2 pricing][r2-pricing] [img pricing][img-pricing] | $5 per 1,000 min stored, $1 per 1,000 min delivered; encoding free. [pricing][stream-pricing] |
| API credentials | Account API token with "Images Write" (Edit) [permissions][cf-perms] | Bucket-scoped "Object Read & Write" S3 keys [tokens][r2-tokens] | "Stream Edit" |

### 1.3 Recommendation: Cloudflare Images for all images (PROPOSED, needs your approval, Q-04)

**Why Images:**
1. **Safety by design.** Cloudflare decodes every upload and rejects anything that isn't an image, and the file never passes through our server. With R2 we would have to download and inspect each object after upload, because R2 accepts arbitrary bytes and a size cap on presigned PUT is not documented.
2. **Least code.** Resizing, format negotiation (AVIF/WebP) and the CDN are built in. No `sharp`, no transformation zone, no bucket CORS policy.
3. **No DNS dependency.** `imagedelivery.net` works without the company domain being on Cloudflare. R2 public access and transformations both require a Cloudflare zone (Q-01).
4. **Predictable cost** for a portfolio site: about **$5/month** for storage up to 100k images, plus $1 per 100k image deliveries. Whether storage is billed in whole 100k blocks (i.e. a $5 minimum) should be confirmed on the Cloudflare billing page before approval: **NOT VERIFIED**.

**Trade-offs accepted:**
- **10 MB per-file limit.** The UI limit drops from 15 MB to 10 MB, or the browser downscales larger files before upload, as it already does today (`MediaAdmin.tsx:26-34`).
- **AVIF uploads are not accepted** (Enterprise only). The admin UI allow-list will be JPEG, PNG, WebP and HEIC. GIF and SVG are excluded on purpose, though Cloudflare accepts them.
- **Width and height** are measured in the browser and sent with the "complete upload" call (DATABASE_DESIGN §3.2).

**When R2 is the better choice:** if Q-01 puts the company DNS on Cloudflare, *and* storage volume or delivery counts grow large enough that R2's free tier and per-GB pricing beat $5 per 100k plus $1 per 100k deliveries. The schema's `provider` column allows a later migration.

**Video is now required** by the client requirements (CR-CMS-04): uploaded videos and embedded video links. The design is in §11. Uploaded video uses Cloudflare Stream, which has a fixed monthly cost and needs your approval (Q-25); embedded YouTube and Vimeo links cost nothing.

### 1.4 Upload flow (Cloudflare Images, Direct Creator Upload)

```
Admin browser                 Express API (Render)                 Cloudflare Images
     |  POST /api/admin/media/uploads          |                            |
     |  {filename, mimeType, bytes,            |                            |
     |   width, height, category}  ----------> |  validate (type allow-list,|
     |                                         |  bytes ≤ 10 MB, dims)      |
     |                                         |  POST v2/direct_upload ---> |
     |                                         |  <--- {id, uploadURL}      |
     |                                         |  INSERT MediaAsset PENDING |
     |  <---- {mediaId, uploadURL, expiresAt}  |                            |
     |  POST uploadURL (multipart "file") ------------------------------->  |
     |  <------------------------------------------------- 200 / error     |
     |  POST /api/admin/media/:id/complete --> |  GET images/v1/{id} -----> |
     |                                         |  <--- details (uploaded)   |
     |                                         |  UPDATE status = READY,    |
     |                                         |  write ActivityLog         |
     |  <---- MediaAsset (READY, url)          |                            |
```

- **The one-time URL** is short-lived: 2–5 minutes, configurable within Cloudflare's 2-minute minimum (VERIFIED). Only an authenticated admin can request one.
- **"Complete"** is idempotent. If the image isn't uploaded yet, the API returns `409 UPLOAD_NOT_FINISHED` and the UI retries briefly.
  - **NOT VERIFIED:** exactly how Cloudflare signals "not uploaded yet" (a `draft` flag vs a 404). The Phase 5 spike settles it against the real API.
- **Cloudflare `metadata`** is set to `{ mediaId }`, which links remote images back to rows during orphan sweeps.

### 1.5 Delivery and Next.js

- Enable **flexible variants** (`PATCH /images/v1/config {"flexible_variants": true}`, VERIFIED; incompatible with signed URLs, which we don't need because all site images are public).
- Add a Next.js **custom image loader** (`images.loader: 'custom'`, `loaderFile`, VERIFIED) that builds `https://imagedelivery.net/<hash>/<id>/w=<width>,q=<quality>` for Cloudflare-hosted media. Local `/images/*` files keep the default behaviour.
- This also keeps image transformations off Vercel's metered Image Optimization (Hobby includes 5K transformations; paid plans bill per transformation, VERIFIED).
- **NOT VERIFIED:** the exact flexible-variant parameter names to use (`w`, `q`, `fit`, `format`). Phase 5 confirms them against the docs and a live request.

### 1.6 Replacement, deletion, orphans

| Case | Handling |
|---|---|
| Replace an image on a project/service/member | Change the reference only. The old asset stays in the library (that's the current UX). |
| Delete a media asset | API refuses with **409 MEDIA_IN_USE** plus the list of users while any foreign key references it (Q-11). Otherwise: delete the row, commit, then `DELETE` at Cloudflare. A remote failure is logged and retried by the sweep. |
| Abandoned upload (row stuck in `PENDING`) | A sweep runs every 15 minutes in-process. It deletes `PENDING` rows older than 1 hour and their Cloudflare image (if one exists). |
| Remote image without a row | A monthly manual script (`npm run media:reconcile`) lists Cloudflare images and reports ids with no matching row, using `metadata.mediaId` as the link. It deletes only after confirmation (dry-run by default). |

### 1.7 Secrets and permissions

- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_IMAGES_API_TOKEN` (account token scoped to **Images Write only**) and `CLOUDFLARE_IMAGES_ACCOUNT_HASH` (public; used in delivery URLs).
- Stored only in Render environment variables. Never sent to the browser. Never logged (pino redaction, SECURITY_PLAN §8).

### 1.8 Error handling

| Failure | API response |
|---|---|
| Cloudflare 5xx or timeout while creating an upload URL | `502 UPSTREAM_UNAVAILABLE`; nothing written |
| Browser upload rejected by Cloudflare (too big, wrong format) | Shown directly to the admin by the UI; the `PENDING` row is later swept |
| Cloudflare error on delete | Row already gone; logged at `warn` for the reconcile script |

- Every Cloudflare call has a timeout (10 s) and retries idempotent GET/DELETE calls once.

---

## 2. Spam protection: Cloudflare Turnstile (Q-09)

- **Verified facts:**
  - Free with **unlimited challenges** (up to 20 widgets) [plans][ts-plans].
  - The server must call `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret` and `response` (optional `remoteip`, `idempotency_key`).
  - Tokens are valid **300 s** and single-use; a reused token returns `timeout-or-duplicate` [docs][ts-verify].
- **Proposed contact-form protection, in order:**
  1. Body size limit.
  2. Per-IP rate limit.
  3. Hidden honeypot field (reject silently with `202`).
  4. Turnstile token verification.
  5. Strict schema validation.
- **If Turnstile is declined**, steps 1–3 and 5 remain. That is weaker against scripted spam, but has no third-party script on the public site.
- **Frontend work:** add the Turnstile widget to `ContactForm` (Phase 11).
- **Env:** `TURNSTILE_SECRET_KEY` (server) and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (client).

---

## 3. Email: Google Workspace (Gmail) bought through domenebi.ge (DECIDED; account details in Q-29)

### 3.1 What the code requires

**No email is sent today** (audit F-15). Candidate emails, all pending your confirmation:

| Email | To | Trigger | Recommendation |
|---|---|---|---|
| New-inquiry notification | Company inbox | `POST /api/public/inquiries` succeeds | **Yes.** Highest value, lowest risk |
| Acknowledgement to the visitor | Visitor's address | Same | Optional. If enabled, send a fixed template (in the visitor's language) that **does not echo the message text**, so the form can't be used to send arbitrary content to arbitrary addresses |
| Password reset link + "password changed" notice | Admin's registered address | Admin request | **DECIDED** (Q-06), Phase 4 logic + Phase 10 delivery |

### 3.2 What is known (Google Workspace)

**Your answer:** the company mailbox is **Gmail bought through domenebi.ge**, i.e. Google Workspace. domenebi.ge resells it ([GSuite post][dg-gsuite]). Sending therefore follows **Google's** rules, not domenebi.ge's.

| Fact (VERIFIED, Google help pages, fetched 2026-11-20 through search summaries) | Source |
|---|---|
| Password-only ("less secure app") sign-in for Workspace accounts is no longer supported (from May 2025). Apps must use OAuth, or an **app password** on an account with 2-Step Verification | [LSA transition][g-lsa], [app passwords][g-apppw] |
| SMTP server `smtp.gmail.com`, port **465** (implicit TLS) or **587** (STARTTLS); supports OAuth 2.0 via SASL XOAUTH2 | [Gmail IMAP/SMTP][g-smtp] |
| App passwords are **revoked when the account password changes** | [app passwords][g-apppw] |
| Sending limit for a Workspace user: about **2,000 messages per day** (rolling 24 h) | [sending limits][g-limits] |
| SMTP relay (`smtp-relay.gmail.com`) exists, configured in the Admin console, typically authenticated by IP address. It is not suitable for Render's shared outbound IPs without further verification, so it is **not** planned | [SMTP relay][g-relay] |
| SPF: TXT record `v=spf1 include:_spf.google.com ~all` at the DNS host | [SPF][g-spf] |
| DKIM: a **super administrator** generates a key in Admin console → Apps → Google Workspace → Gmail → Authenticate email, adds the `google._domainkey` TXT record, then turns signing on (key generation may need 24–72 h after Gmail is enabled) | [DKIM][g-dkim] |
| DMARC: add it after SPF and DKIM have worked for ~48 h | [DMARC][g-dmarc] |

**NOT VERIFIED:** whether sending with an **alias** as the From address over `smtp.gmail.com` keeps the alias, or Gmail rewrites it to the account address (Q-29 option B). Phase 10 tests this before relying on it.

### 3.3 Proposed implementation

- **Library:** `nodemailer` over SMTP to `smtp.gmail.com:465` (TLS). Its current version is checked when Phase 10 starts.
- **Authentication (PROPOSED):**
  - **App password** on the sending account (2-Step Verification on). It's simplest: one secret, `SMTP_PASSWORD`.
  - Because Google revokes app passwords when the account password changes, the runbook includes "after changing the sending account's password, create a new app password and update Render".
  - **OAuth2 (XOAUTH2)** is the fallback if your Workspace policy disallows app passwords.
- **Sender:** one of the two existing mailboxes (`info@` or `dev@manidevelopment.ge`), chosen in Q-29. The account needs 2-Step Verification and an app password. **The mailbox's normal password is never stored anywhere in the server.**
- **Render constraint (VERIFIED):** "Free web services can't send outbound network traffic on ports 25, 465, or 587" [render free][render-free]. Email therefore **requires a paid Render instance**, which the plan already recommends for other reasons (§4).
- **Two delivery paths:**
  - **Password-reset emails** are sent directly after the token is saved (one retry; the admin can ask again). See SECURITY_PLAN §2.
  - **Inquiry emails** go through the durable outbox described below.
- **Durable delivery:**
  - The inquiry is committed first. The email is written to an `EmailMessage` outbox row in the **same** transaction (DATABASE_DESIGN §3.6).
  - A small in-process worker sends pending rows. It retries with backoff (1 min, 5 min, 30 min, 2 h, 12 h), stops after 5 attempts and marks the row `failed`.
  - The inquiry is in the admin inbox either way, so an SMTP outage loses no leads.
- **Safety:**
  - Templates are plain text plus simple escaped HTML.
  - User-supplied values are escaped and stripped of CR/LF before use in headers (prevents header injection).
  - The `Reply-To` of the company notification is the visitor's validated address, so staff can reply directly.
- **Deliverability:**
  - Gmail and Yahoo require **SPF or DKIM from all senders** (VERIFIED: [google][g-senders], [yahoo][y-senders]).
  - With Workspace: SPF `include:_spf.google.com`, DKIM turned on in the Admin console, then DMARC `p=none` (table above).
  - These DNS records go wherever the domain's DNS is hosted (Amazon Route 53 nameservers; who has access is Q-28).
  - **Checked 2026-11-20 (§7):** the SPF record for Google already exists; DKIM and DMARC records do not. Phase 10 adds those two.

**Env:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `INQUIRY_NOTIFY_TO`.

### 3.4 Alternatives (recorded only; superseded by your choice)

| Provider | Verified facts |
|---|---|
| Resend | 3,000/month free, 100/day; Pro $20/mo. Account data stored in the US [resend][resend] |
| Postmark | 100/month free; Basic $15/mo [postmark][postmark] |
| Amazon SES | $0.10 per 1,000; sandbox until production access is granted [ses][ses] |
| Brevo | 300/day free after account approval [brevo][brevo] |
| Cloudflare Email Sending | Public **beta**; REST API callable from any server; needs Workers Paid for arbitrary recipients [cf-email][cf-email] |

These only matter if sending through Google Workspace turns out to be unsuitable (e.g. app passwords disabled by policy and OAuth2 setup not possible). In that case Phase 10 comes back to you.

---

## 4. Render (backend hosting) — verified facts

| Fact | Source |
|---|---|
| Bind to `0.0.0.0` on `PORT` (default 10000) | [web services][render-web] |
| Node version precedence: `NODE_VERSION` env → `.node-version` → `.nvmrc` → `engines` | [node version][render-node] |
| **Pre-deploy command** runs after the build, before the deploy, on a separate instance; a failure aborts the deploy; **paid plans only** | [deploys][render-deploys], [blueprint][render-bp] |
| Health check: `healthCheckPath`, must answer 2xx/3xx within 5 s; traffic switches only when new instances pass; a failing deploy is cancelled after 15 min | [health checks][render-health] |
| **Free web service:** spins down after 15 min idle, ~1 min cold start, may restart any time, **SMTP ports blocked**, no shell | [free][render-free] |
| **Free Postgres:** 1 GB, **expires after 30 days**, **no backups** | [free][render-free] |
| Cheapest paid web service `0.5c-512mb` (formerly Starter): **$7/month**, 512 MB RAM | [pricing][render-pricing] |
| Cheapest paid Postgres `0.1c-256mb`: **$6/month**, 100 connections, storage $0.30/GB | [pricing][render-pricing] |
| Point-in-time recovery: paid only, **3 days (Hobby workspace) / 7 days (Pro)**; logical exports kept 7 days | [backups][render-backups] |
| Use the **internal** DB URL within the same region; external connections require TLS | [postgres][render-pg] |
| Regions: Oregon, Ohio, Virginia, **Frankfurt**, Singapore. Region can't be changed later | [regions][render-regions] |
| Custom domains get automatic TLS; Render's load balancer terminates TLS and forwards plain HTTP | [custom domains][render-domains] |
| Rollback re-deploys a previous build artifact and env vars. The docs say nothing about databases, so assume **migrations are not rolled back** | [rollbacks][render-rollbacks] |
| Logs kept 7/14/30 days by workspace plan; log streams to syslog/Datadog etc. | [logging][render-logs] |
| Client IP: traffic passes through Cloudflare and Render's load balancer. `X-Forwarded-For` is appended, so the **left-most entry is client-controlled**; `CF-Connecting-IP` is available. *Source is a Render article, not the reference docs* | [article][render-xff] |

**Plan:**
- Region **Frankfurt**. It is the only European region; latency to Georgia is not documented, so measure it in Phase 3.
- **Paid web service and paid Postgres** for production, because of spin-down, database expiry, no backups and blocked SMTP on the free tier.
- `preDeployCommand: npx prisma migrate deploy`, `healthCheckPath: /api/health/ready`.

**Express `trust proxy`:**
- The exact hop count can't be derived from the docs.
- **Phase 3 task:** on staging, log `X-Forwarded-For`, `CF-Connecting-IP` and `req.ips` from a known client, then set `trust proxy` to that hop count (never `true`, per [Express docs][express-proxy]), or key rate limits on `CF-Connecting-IP` if it proves reliable.
- Until verified, this is **BLOCKED** for production rate limiting.

---

## 5. PostgreSQL hosting (Q-08)

**Recommendation: Render Postgres in the same region as the API** (private network, one vendor, PITR on paid plans).

- Alternatives such as Neon or Supabase would add a public network hop and another vendor account. They are not evaluated further unless you prefer them.
- **Prisma 7 specifics (VERIFIED):**
  - pinned `7.10.1`
  - `@prisma/adapter-pg` driver adapter
  - `prisma.config.ts` holds the datasource URL
  - ESM
  - minimum Node 20.19, TypeScript 5.4
  - See DATABASE_DESIGN §1.

---

## 6. Vercel (frontend hosting) — verified facts and implications

| Fact | Implication |
|---|---|
| **Hobby plan: "only … for your personal or non-commercial use"** [terms][vercel-terms] | A company website should run on a paid Vercel plan (Q-08). Pro pricing was not checked: **NOT VERIFIED** |
| Env vars scoped to Production / Preview / Development; changes apply to new deployments only; `NEXT_PUBLIC_*` is inlined into the client bundle at build time [env][vercel-env] | API base URL and Turnstile site key are `NEXT_PUBLIC_*`; the revalidation secret is server-only |
| External rewrites can proxy to another origin (120 s timeout); upstream `Cache-Control` is honoured by default for projects created after 2026-04-06; responses with `Set-Cookie` are never cached. Body size limit and `Set-Cookie` pass-through are **NOT VERIFIED** [rewrites][vercel-rewrites] [cache][vercel-cache] | The proxy topology (§7, option B) has undocumented behaviour, which is a reason not to depend on it |
| Image Optimization is metered (Hobby: 5K transformations); can be bypassed with a custom loader [pricing][vercel-img] | Cloudflare loader (§1.5) |
| Next.js 16: `'use cache'` + `cacheTag`; `revalidateTag(tag, 'max')` or `{ expire: 0 }` can be called from a **Route Handler** (`updateTag` only from Server Actions) [revalidateTag][next-revalidate] [use cache][next-usecache] | §8 revalidation webhook |
| `'use cache'` storage is in-memory by default; "Hosting providers can replace the default cache handler". Vercel's behaviour is **NOT VERIFIED** | Phase 11 spike: confirm cached server fetches persist and invalidate correctly on Vercel |
| `proxy.ts` replaces `middleware.ts` in Next 16 and runs on Node.js [proxy][next-proxy] | Consistent with `client/proxy.ts` |

---

## 7. Domain and cookie topology (Q-01, **blocks Phase 4**)

**Verified facts:**
- `onrender.com` and `vercel.app` are on the **Public Suffix List** [psl][psl], so `x.vercel.app` → `y.onrender.com` is **cross-site**.
- Safari blocks all third-party cookies by default [webkit][webkit-itp].
- Firefox partitions them [mdn][mdn-3pc]. Chrome still allows them by default as of 2026 [mdn][mdn-3pc].
- Sub-domains of one registrable domain are **same-site** [mdn][mdn-site].
- Safari caps cookies to **7 days** when a first-party sub-domain is a CNAME to another site ("CNAME cloaking") [webkit][webkit-itp].

| Option | How it works | Verdict |
|---|---|---|
| **A. Custom sub-domains (recommended)** | Site at `www.manidevelopment.ge` (Vercel), API at `api.manidevelopment.ge` (Render). The admin fetches with `credentials: 'include'`; the cookie is host-only on `api.`, `SameSite=Lax`, `Secure`, `HttpOnly`; CORS allows the site's origin with credentials | Works in all browsers. Safari's CNAME cap limits the cookie to 7 days, which matches the proposed 7-day maximum session (SECURITY_PLAN §2) |
| B. Proxy through Vercel (`www.manidevelopment.ge/api/*` → Render) | First-party cookie, no CORS | Works, but adds a hop and Vercel limits. Cookie pass-through and body limits are NOT VERIFIED. Render sees Vercel's IPs, which breaks per-IP rate limiting unless forwarded headers are trusted |
| C. Default hosts (`*.vercel.app` + `*.onrender.com`) with `SameSite=None` cookies | Third-party cookie | **Does not work in Safari** (verified). Rejected |
| D. Bearer token stored in the browser | No cookies | Token readable by any XSS; not recommended for an admin panel |

**Answered (Q-01):** the domain is **`manidevelopment.ge`**, so option A is the plan: `www.manidevelopment.ge` (site) and `api.manidevelopment.ge` (API), plus `staging.` and `api-staging.` if Q-14 = yes.

**What the public DNS shows today** (VERIFIED by DNS lookup from the development machine, 2026-11-20):

| Record | Finding | Consequence |
|---|---|---|
| Nameservers | Four `awsdns` servers (Amazon Route 53) | The zone is hosted on Route 53. **Who can edit it** (a domenebi.ge control panel, or an AWS account) is not visible from outside: Q-28 |
| Bare domain, `www`, `api` | No address records | **No website is live on the domain.** No existing URLs need redirecting at launch (Q-31 asks about any earlier site) |
| MX | `smtp.google.com` | Confirms the mail is Google Workspace |
| TXT (SPF) | `v=spf1 include:_spf.google.com ~all` | SPF for Google is **already in place** |
| `google._domainkey` (DKIM) | No record | DKIM is **not set up** with Google's default selector. Phase 10 task |
| `_dmarc` | No record | DMARC is **not set up**. Phase 10 task, after DKIM |

- DNS records needed: `www`, `api` (Phase 16), staging names (Phase 3), DKIM and DMARC (Phase 10), and optionally a Search Console verification record (Phase 16).
- Moving DNS to Cloudflare is **not required** for the recommended Images setup.

**Mailboxes named by you:** `info@manidevelopment.ge` and `dev@manidevelopment.ge`. `info@` is also the public contact address in the seed settings (`client/data/seed.ts:688`). Which one sends website email, which receives inquiries and which is the admin's login is Q-29.

**Consequence for preview deployments:**
- Vercel preview URLs (`*.vercel.app`) are cross-site to `api.manidevelopment.ge`, so **admin login won't work on preview URLs**. Public pages will still work.
- Admin testing happens on a staging domain pair (Q-14).

---

## 8. Frontend cache revalidation

Public pages fetch from the API on the Next.js server (Phase 11) and cache with `'use cache'` + `cacheTag('projects')`, etc. After a successful admin mutation, the API calls:

```
POST https://www.manidevelopment.ge/api/revalidate
Authorization: Bearer <REVALIDATE_SECRET>
{ "tags": ["projects", "project:<slug>"] }
```

- A Route Handler on the frontend verifies the secret in constant time and calls `revalidateTag(tag, { expire: 0 })`.
- **The call runs after the commit, with a timeout. Its failure never fails the admin request:** it is logged, and pages also carry a time-based `cacheLife` (e.g. `minutes`) as a fallback.
- **Env:** `FRONTEND_REVALIDATE_URL`, `REVALIDATE_SECRET` (shared, 32+ random bytes).

---

## 9. Environment variable contract (server)

All variables are validated at startup with Zod. **The process exits with a clear error if any required variable is missing or malformed.** `.env.example` documents them, and real values live only in local `.env` (git-ignored) and Render.

| Variable | Phase | Required | Example / rule |
|---|---|---|---|
| `NODE_ENV` | 1 | yes | `development` \| `test` \| `production` |
| `PORT` | 1 | no (default 4000 locally; Render sets 10000) | integer |
| `DATABASE_URL` | 1 | yes | `postgresql://…` (Render internal URL in production) |
| `CORS_ORIGINS` | 1 | yes | comma-separated exact origins, e.g. `https://www.manidevelopment.ge` |
| `LOG_LEVEL` | 1 | no | `info` (default), `debug` in development |
| `TRUST_PROXY_HOPS` | 1 | prod: yes | integer from the Phase 3 measurement |
| `SESSION_COOKIE_NAME` | 4 | no | default `__Host-sid`. The `__Host-` prefix is valid because the cookie is host-only on `api.manidevelopment.ge` with `Secure` and `Path=/` (SECURITY_PLAN §2) |
| `SESSION_IDLE_MINUTES` / `SESSION_MAX_DAYS` | 4 | no | defaults 720 / 7 |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_IMAGES_API_TOKEN`, `CLOUDFLARE_IMAGES_ACCOUNT_HASH` | 5 | yes (from Phase 5) | |
| `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_CUSTOMER_CODE` | 5 | if Q-25 = yes | token scoped to Stream Edit only; the customer code is public (it is part of player addresses) |
| `PREVIEW_TOKEN_TTL_SECONDS` | 6 | no | default 300 |
| `TURNSTILE_SECRET_KEY` | 9 | if Q-09 = yes | |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `INQUIRY_NOTIFY_TO` | 10 | yes when `MAIL_TRANSPORT=smtp` | `smtp.gmail.com`, `465`, `true`, sending account, **app password (secret: enter in Render only)**, From address, notification recipient |
| `EMAIL_ENABLED` | 10 | no (default `true` in production) | kill switch: `false` keeps queuing but stops sending (Phase 10 rollback) |
| `FRONTEND_REVALIDATE_URL`, `REVALIDATE_SECRET` | 11 | yes (from Phase 11) | |
| `INTERNAL_API_KEY` | 11 | yes (from Phase 11) | 32+ random bytes; sent by the Next.js server on public reads to bypass the per-IP limiter (SECURITY_PLAN §9), to read drafts in preview and to verify preview tokens |
| `PUBLIC_SITE_URL` | 4 | yes | used for links in emails (password-reset link) |
| `MAIL_TRANSPORT` | 4 | yes | `console` (development only; refused elsewhere) \| `smtp` (staging/production, from Phase 10) \| `fake` (tests) |

**Frontend (Vercel) variables added by the new scope:**

| Variable | Phase | Secret? | Use |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | 11 | no | `https://www.manidevelopment.ge`; base for canonical, sitemap and social-image URLs |
| `NEXT_PUBLIC_API_URL` | 11 | no | API base for browser calls |
| `API_INTERNAL_URL`, `INTERNAL_API_KEY` | 11 | **yes** (key) | server-side reads, preview, path resolution |
| `REVALIDATE_SECRET` | 11 | **yes** | checks the API's cache-refresh calls |
| `NEXT_PUBLIC_CF_IMAGES_HASH`, `NEXT_PUBLIC_CF_STREAM_CODE` | 11 | no | image and video delivery addresses |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 11 | no | contact form widget |
| `SITE_NOINDEX` | 11 | no | `true` on every non-production deployment: adds `X-Robots-Tag: noindex, nofollow` |

The Tag Manager ID and the Search Console token are **not** environment variables. They are settings the client edits (DATABASE_DESIGN §3.8).

---

## 10. Next.js 16 behaviour the SEO and preview design relies on (verified 2026-11-20)

| Fact | Source |
|---|---|
| A relative URL in metadata without `metadataBase` "will cause a build error" | [generateMetadata][next-meta] |
| `alternates.canonical` and `alternates.languages` produce canonical and `hreflang` links; `x-default` is in Next.js's types but **not in its docs** | [generateMetadata][next-meta] |
| `robots` and `verification.google` metadata fields exist | [generateMetadata][next-meta] |
| Metadata is streamed for browsers, but Next.js waits for it for "HTML-limited bots" (e.g. Facebook's crawler); Googlebot reads streamed metadata | [generateMetadata][next-meta] |
| `sitemap.ts` entries support `lastModified` and `alternates.languages`; `robots.ts` supports rules and a sitemap line | [sitemap][next-sitemap], [robots][next-robots] |
| JSON-LD: render a native `<script>` tag and replace `<` with `<` | [JSON-LD guide][next-jsonld] |
| Draft Mode: `draftMode().enable()` in a Route Handler sets the `__prerender_bypass` cookie; cached functions re-run on every request while it is on; check a secret and take the redirect path from the CMS, not from the query string | [Draft Mode][next-draft] |
| `permanentRedirect()` sends 308, but inside a streaming response it becomes a meta tag | [permanentRedirect][next-predirect] |
| Redirects stored in a database should be served from Proxy; `next.config` redirects are limited to 1,024 on Vercel | [redirecting guide][next-redirecting] |
| `notFound()` returns 404 only before streaming starts. With Cache Components, a request-time check leaves the status at 200. The documented fix is to check the slug in Proxy | [not-found][next-notfound] |
| With Cache Components, `generateStaticParams` "must return at least one param"; an empty array is a build error | [generateStaticParams][next-gsp] |
| `@next/third-parties` is "currently an experimental library" | [third-party libraries][next-3p] |
| `next/script` `afterInteractive` is the strategy for tag managers and analytics | [Script][next-script] |
| `priority` on images is deprecated in favour of `preload` or `loading="eager"` with `fetchPriority="high"` | [Image][next-image] |
| A nonce-based Content-Security-Policy requires dynamic rendering and "is incompatible" with partial prerendering. The static alternative uses `'unsafe-inline'`; hash-based SRI support is experimental | [CSP guide][next-csp] |

**Consequences built into the plan:**
- Redirects and real 404s are decided in `proxy.ts` (SEO_ANALYTICS_PERFORMANCE §6).
- Preview uses Draft Mode with a one-time token (API_CONTRACTS §8.8).
- Tag Manager uses `next/script`, not `@next/third-parties`.
- The site's Content-Security-Policy is a static header (SECURITY_PLAN §17).
- **Launch risk:** production may start with zero projects (Q-10). A build with an empty `generateStaticParams` would fail, so the project route must not depend on a non-empty list (Phase 11 task).

## 11. Video: Cloudflare Stream and embeds (CR-CMS-04; Q-25)

**Uploaded video → Cloudflare Stream (verified facts):**

| Fact | Source |
|---|---|
| Direct upload: the server calls `POST …/stream/direct_upload` with a required `maxDurationSeconds` and gets a one-time `uploadURL` and the video `uid` | [direct upload API][stream-dcu-api] |
| A simple upload is limited to 200 MB; larger files need the tus resumable protocol | [direct creator uploads][stream-dcu] |
| Video details give `status.state` (`pendingupload`, `downloading`, `queued`, `inprogress`, `ready`, `error`) and `readyToStream`; `duration` and `thumbnail` appear once encoded | [video details API][stream-get] |
| "Poll the Stream API until `readyToStream` is `true`, or use webhooks." Only one webhook per account | [get started][stream-start], [webhooks][stream-webhooks] |
| Player: `https://customer-<CODE>.cloudflarestream.com/<UID>/iframe`, with `poster`, `preload`, `controls`, `muted`, `loop`, `autoplay` | [Stream player][stream-play] |
| Thumbnail: `https://customer-<CODE>.cloudflarestream.com/<UID>/thumbnails/thumbnail.jpg?time=…&height=…` | [thumbnails][stream-thumbs] |
| Storage is prepaid "in increments of $5 per month for each 1,000 minutes"; delivery is $1 per 1,000 minutes watched; uploading and encoding are free | [pricing][stream-pricing] |
| An unfinished direct upload reserves its `maxDurationSeconds` against the storage quota | [pricing][stream-pricing] |

**Design (PROPOSED):**
- The flow mirrors image uploads (§1.4), with a `processing` state while Cloudflare encodes. The API **polls** video details when the admin UI asks for status. No webhook: the account allows only one, which staging and production would have to share.
- MVP limits: 200 MB and 10 minutes per video. Resumable uploads for larger files are a future enhancement.
- Abandoned video uploads are swept like images (§1.6), which also releases the reserved minutes.
- `allowedOrigins` on each video is set to the site's hosts, so the player can't be embedded elsewhere.
- **Cost to approve (Q-25):** at least **$5/month** (1,000 minutes of storage) plus $1 per 1,000 minutes watched. Whether any free allowance exists is NOT VERIFIED (none is documented).

**Embedded video links (no cost):**
- YouTube: `https://www.youtube-nocookie.com/embed/<VIDEO_ID>` (privacy-enhanced mode, VERIFIED: [YouTube help][yt-nocookie]).
- Vimeo: `https://player.vimeo.com/video/<id>?dnt=1` (VERIFIED: [Vimeo player parameters][vimeo-params]).
- The server stores only the provider and the video ID (API_CONTRACTS §8.1).

**If Q-25 = no:** the `video` block type and Stream are left out of the MVP, and video is delivered through embeds only. The schema already allows adding Stream later.

**Cloudflare Images flexible variants (previously unverified, now VERIFIED):** options are a comma-separated list such as `w=400,q=75`; names include `width`/`w`, `height`/`h`, `quality`/`q` (default 85), `fit`, `format`/`f`; for hosted images `format=auto` is the default (AVIF, then WebP, then the original); the feature is off until enabled ([features][img-features], [flexible variants][img-flex2]).

## 12. Google Search guidance used by the SEO design (verified 2026-11-20)

The individual rules are quoted where they are applied, in SEO_ANALYTICS_PERFORMANCE §1–8. Source pages:
- Titles and descriptions: [title links][g-title], [snippets][g-snippet]
- Canonicals and duplicates: [consolidate duplicate URLs][g-canonical]
- Languages: [localized versions (hreflang)][g-hreflang], [multi-regional sites][g-multi]
- Crawling and indexing: [robots.txt intro][g-robots], [block indexing (noindex)][g-noindex], [build a sitemap][g-sitemap]
- Redirects and moved URLs: [redirects][g-redirects], [site moves][g-sitemove], [soft 404 and crawl errors][g-soft404]
- Structured data: [intro][g-sd], [Organization][g-org], [LocalBusiness][g-local], [Breadcrumb][g-breadcrumb], [Video][g-video-sd]; schema.org [GeneralContractor][schema-gc]
- Media: [image SEO][g-images], [video SEO][g-video], [lazy loading][g-lazy]
- Other: [SEO starter guide (headings)][g-starter], [JavaScript SEO][g-js], [site names][g-sitename], [favicons][g-favicon], [Core Web Vitals][webdev-vitals], [Search Console verification][g-verify]

## 13. Analytics, consent and contact links (verified 2026-11-20)

The rules are applied in SEO_ANALYTICS_PERFORMANCE §9–10. Source pages:
- Tag Manager: [install][gtm-install], [containers][gtm-containers], [data layer][gtm-datalayer], [Google tag in GTM][gtm-googletag], [click triggers][gtm-click], [custom event trigger][gtm-custom]
- GA4: ["use either the Google tag or Tag Manager, not both"][ga-notboth], [enhanced measurement][ga-enhanced], [recommended events][ga-recommended], [event naming rules][ga-naming], [key events][ga-key], [IP addresses][ga-ip]
- Consent: [consent mode concepts][consent-concepts], [consent mode setup][consent-guide], [consent in Tag Manager][gtm-consent], [EU user consent policy][eu-consent]
- Contact links: [WhatsApp click to chat][wa-click], [Messenger m.me links][m-me], [Google Maps URLs][maps-urls], [Maps Embed API][maps-embed]
- Search Console and Tag Manager both need accounts the client owns (Q-26, Q-27).

---

## Sources

[next-meta]: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
[next-sitemap]: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
[next-robots]: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
[next-jsonld]: https://nextjs.org/docs/app/guides/json-ld
[next-draft]: https://nextjs.org/docs/app/guides/draft-mode
[next-predirect]: https://nextjs.org/docs/app/api-reference/functions/permanentRedirect
[next-redirecting]: https://nextjs.org/docs/app/guides/redirecting
[next-notfound]: https://nextjs.org/docs/app/api-reference/file-conventions/not-found
[next-gsp]: https://nextjs.org/docs/app/api-reference/functions/generate-static-params
[next-3p]: https://nextjs.org/docs/app/guides/third-party-libraries
[next-script]: https://nextjs.org/docs/app/api-reference/components/script
[next-image]: https://nextjs.org/docs/app/api-reference/components/image
[next-csp]: https://nextjs.org/docs/app/guides/content-security-policy
[stream-dcu-api]: https://developers.cloudflare.com/api/resources/stream/subresources/direct_upload/methods/create/
[stream-get]: https://developers.cloudflare.com/api/resources/stream/methods/get/
[stream-start]: https://developers.cloudflare.com/stream/get-started/
[stream-webhooks]: https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/
[stream-thumbs]: https://developers.cloudflare.com/stream/viewing-videos/displaying-thumbnails/
[img-features]: https://developers.cloudflare.com/images/optimization/features/
[img-flex2]: https://developers.cloudflare.com/images/optimization/hosted-images/enable-flexible-variants/
[yt-nocookie]: https://support.google.com/youtube/answer/171780
[vimeo-params]: https://help.vimeo.com/hc/en-us/articles/12426260232977-About-Player-Parameters
[g-title]: https://developers.google.com/search/docs/appearance/title-link
[g-snippet]: https://developers.google.com/search/docs/appearance/snippet
[g-canonical]: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
[g-hreflang]: https://developers.google.com/search/docs/specialty/international/localized-versions
[g-multi]: https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites
[g-robots]: https://developers.google.com/search/docs/crawling-indexing/robots/intro
[g-noindex]: https://developers.google.com/search/docs/crawling-indexing/block-indexing
[g-sitemap]: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
[g-redirects]: https://developers.google.com/search/docs/crawling-indexing/301-redirects
[g-sitemove]: https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
[g-soft404]: https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors
[g-sd]: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
[g-org]: https://developers.google.com/search/docs/appearance/structured-data/organization
[g-local]: https://developers.google.com/search/docs/appearance/structured-data/local-business
[g-breadcrumb]: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
[g-video-sd]: https://developers.google.com/search/docs/appearance/structured-data/video
[schema-gc]: https://schema.org/GeneralContractor
[g-images]: https://developers.google.com/search/docs/appearance/google-images
[g-video]: https://developers.google.com/search/docs/appearance/video
[g-lazy]: https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading
[g-starter]: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
[g-js]: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
[g-sitename]: https://developers.google.com/search/docs/appearance/site-names
[g-favicon]: https://developers.google.com/search/docs/appearance/favicon-in-search
[webdev-vitals]: https://web.dev/articles/vitals
[g-verify]: https://support.google.com/webmasters/answer/9008080
[gtm-install]: https://support.google.com/tagmanager/answer/14847097
[gtm-containers]: https://support.google.com/tagmanager/answer/14842164
[gtm-datalayer]: https://developers.google.com/tag-platform/tag-manager/datalayer
[gtm-googletag]: https://support.google.com/tagmanager/answer/15756616
[gtm-click]: https://support.google.com/tagmanager/answer/7679320
[gtm-custom]: https://support.google.com/tagmanager/answer/7679219
[ga-notboth]: https://support.google.com/analytics/answer/9311124
[ga-enhanced]: https://support.google.com/analytics/answer/9216061
[ga-recommended]: https://developers.google.com/analytics/devguides/collection/ga4/reference/events
[ga-naming]: https://support.google.com/analytics/answer/13316687
[ga-key]: https://support.google.com/analytics/answer/13965727
[ga-ip]: https://support.google.com/analytics/answer/2763052
[consent-concepts]: https://developers.google.com/tag-platform/security/concepts/consent-mode
[consent-guide]: https://developers.google.com/tag-platform/security/guides/consent
[gtm-consent]: https://support.google.com/tagmanager/answer/10718549
[eu-consent]: https://www.google.com/about/company/user-consent-policy/
[wa-click]: https://faq.whatsapp.com/5913398998672934
[m-me]: https://developers.facebook.com/docs/messenger-platform/discovery/m-me-links
[maps-urls]: https://developers.google.com/maps/documentation/urls/get-started
[maps-embed]: https://developers.google.com/maps/documentation/embed/get-started
[img-dcu]: https://developers.cloudflare.com/images/upload-images/direct-creator-upload/
[img-limits]: https://developers.cloudflare.com/images/get-started/limits/
[img-variants]: https://developers.cloudflare.com/images/manage-images/create-variants/
[img-flex]: https://developers.cloudflare.com/images/manage-images/enable-flexible-variants/
[img-serve]: https://developers.cloudflare.com/images/optimization/hosted-images/serve-from-custom-domains/
[img-get]: https://developers.cloudflare.com/api/resources/images/subresources/v1/methods/get/
[img-delete]: https://developers.cloudflare.com/images/manage-images/delete-images/
[img-pricing]: https://developers.cloudflare.com/images/pricing/
[img-transform]: https://developers.cloudflare.com/images/transform-images/
[r2-presign]: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
[r2-cors]: https://developers.cloudflare.com/r2/buckets/cors/
[r2-public]: https://developers.cloudflare.com/r2/buckets/public-buckets/
[r2-pricing]: https://developers.cloudflare.com/r2/pricing/
[r2-tokens]: https://developers.cloudflare.com/r2/api/tokens/
[cf-perms]: https://developers.cloudflare.com/fundamentals/api/reference/permissions/
[stream-dcu]: https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/
[stream-formats]: https://developers.cloudflare.com/stream/uploading-videos/
[stream-play]: https://developers.cloudflare.com/stream/viewing-videos/using-the-stream-player/
[stream-pricing]: https://developers.cloudflare.com/stream/pricing/
[ts-verify]: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
[ts-plans]: https://developers.cloudflare.com/turnstile/plans/
[cf-email]: https://developers.cloudflare.com/email-service/
[dg-hosting]: https://www.domenebi.ge/hosting
[dg-gsuite]: https://blog.domenebi.ge/rogor-gaviaqtiurot-gsuite/
[g-senders]: https://support.google.com/a/answer/81126
[g-lsa]: https://support.google.com/a/answer/14114704
[g-apppw]: https://support.google.com/mail/answer/185833
[g-smtp]: https://developers.google.com/workspace/gmail/imap/imap-smtp
[g-limits]: https://support.google.com/a/answer/166852
[g-relay]: https://support.google.com/a/answer/2956491
[g-spf]: https://support.google.com/a/answer/33786
[g-dkim]: https://support.google.com/a/answer/174124
[g-dmarc]: https://support.google.com/a/answer/2466580
[y-senders]: https://senders.yahooinc.com/best-practices/
[resend]: https://resend.com/pricing
[postmark]: https://postmarkapp.com/pricing
[ses]: https://aws.amazon.com/ses/pricing/
[brevo]: https://www.brevo.com/products/transactional-email/
[render-web]: https://render.com/docs/web-services
[render-node]: https://render.com/docs/node-version
[render-deploys]: https://render.com/docs/deploys
[render-bp]: https://render.com/docs/blueprint-spec
[render-health]: https://render.com/docs/health-checks
[render-free]: https://render.com/docs/free
[render-pricing]: https://render.com/pricing
[render-backups]: https://render.com/docs/postgresql-backups
[render-pg]: https://render.com/docs/postgresql-creating-connecting
[render-regions]: https://render.com/docs/regions
[render-domains]: https://render.com/docs/custom-domains
[render-rollbacks]: https://render.com/docs/rollbacks
[render-logs]: https://render.com/docs/logging
[render-xff]: https://render.com/articles/how-render-handles-ddos-attacks
[express-proxy]: https://expressjs.com/en/guide/behind-proxies.html
[vercel-terms]: https://vercel.com/legal/terms
[vercel-env]: https://vercel.com/docs/environment-variables
[vercel-rewrites]: https://vercel.com/docs/rewrites
[vercel-cache]: https://vercel.com/docs/caching/cdn-cache
[vercel-img]: https://vercel.com/docs/image-optimization/limits-and-pricing
[next-revalidate]: https://nextjs.org/docs/app/api-reference/functions/revalidateTag
[next-usecache]: https://nextjs.org/docs/app/api-reference/directives/use-cache
[next-proxy]: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
[psl]: https://publicsuffix.org/list/public_suffix_list.dat
[webkit-itp]: https://webkit.org/tracking-prevention/
[mdn-3pc]: https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies
[mdn-site]: https://developer.mozilla.org/en-US/docs/Glossary/Site
