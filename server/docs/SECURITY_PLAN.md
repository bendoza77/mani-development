# Security Plan

**Status:** PROPOSED. Verified facts cite [INTEGRATIONS.md](INTEGRATIONS.md) or official docs. All security testing described here is run only against local, test and staging environments we own, or production with your explicit go-ahead (§15).

---

## 1. What we protect, and from whom

| Asset | Why it matters |
|---|---|
| Admin accounts and sessions | Full control of public content and access to inquiries |
| Inquiries (names, emails, phones, messages) | Personal data from members of the public |
| Public content integrity | Defacement, malicious links, broken pages |
| Cloud credentials (Cloudflare token, SMTP password, DB URL, revalidation secret) | Cost abuse, data loss, sending mail as the company |

| Threat actor | Typical attack |
|---|---|
| Anonymous internet | Scanning, injection attempts, oversized payloads |
| Spam bots | Contact-form flooding; using the form to email third parties |
| Credential attackers | Password guessing or stuffing on `/api/auth/login` |
| Malicious content | Stored XSS through content fields; `javascript:` links |
| Lost or compromised admin device | Stolen session cookie |

---

## 2. Authentication and sessions

**Decision (PROPOSED):** server-side sessions stored in PostgreSQL, referenced by an opaque random token in a cookie. **No JWTs.**

| Why not JWT | Why DB sessions |
|---|---|
| Can't be revoked before expiry without a deny-list (which is a session table anyway) | Logout and "sign out everywhere" are a `DELETE` |
| Larger attack surface (algorithm confusion, key rotation) | One indexed lookup per admin request; admin traffic is tiny |

### Token and storage

- 32 random bytes (`crypto.randomBytes`), base64url-encoded in the cookie.
- The database stores only `SHA-256(token)` (`AdminSession.tokenHash`), so a database leak doesn't hand out live sessions.
- A new token is issued on every login. Logout deletes the row. A password change deletes **all** of that user's sessions.

### Cookie

```
Set-Cookie: __Host-sid=<token>; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=<seconds until absolute expiry>
```

- **`__Host-` prefix:** allowed because the cookie is host-only on `api.manidevelopment.ge` (no `Domain` attribute) and `Secure` with `Path=/`.
- **`SameSite=Strict`:** works because the admin UI on `www.manidevelopment.ge` and the API on `api.manidevelopment.ge` are **same-site** (VERIFIED, INTEGRATIONS §7). The browser never navigates top-level to the API, so Strict costs nothing.
- **Local development:** `http://localhost:3000` → `http://localhost:4000`. Development uses the name `sid` without `Secure`. That is selected only when `NODE_ENV=development`, and startup refuses `Secure=false` in production.

### Lifetimes (PROPOSED, configurable)

| Limit | Value | Notes |
|---|---|---|
| Idle timeout | 12 hours | `lastSeenAt` is updated at most once per 5 minutes |
| Absolute lifetime | 7 days | Safari caps cookies set via a CNAME'd sub-domain at 7 days anyway (VERIFIED, INTEGRATIONS §7) |
| Cleanup | Hourly in-process job | Deletes expired rows |

### Endpoints

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session` returns `{ user: { id, name, email } }` or 401. This replaces `useSession()` (`client/lib/session.ts`).
- `POST /api/auth/password` (change password; requires the current password). The frontend has no screen for it; it's PROPOSED as an API so a non-technical admin can rotate their password once a small form is added. Confirm in Q-06.

### Account creation and recovery (Q-06 decided: one admin, email reset link)

- **No self-registration.** The single admin account is created with `npm run admin:create`, which prompts for email, name and password. It runs locally against the database, or in a Render shell (paid instances only).

**Password reset by email (DECIDED):**
1. **Request.** `POST /api/auth/password-reset/request {email}` **always returns `202`**, whether or not the email belongs to an admin. This prevents account discovery.
   - Rate limit: 3 per hour per IP, plus 3 per hour per email address.
   - If the address matches, the server creates 32 random bytes, stores only their SHA-256 (`PasswordResetToken`, 30-minute expiry, single use) and invalidates any earlier unused token.
2. **Email.** The link is `https://www.manidevelopment.ge/admin/reset-password#token=<token>`.
   - The token is in the URL **fragment**, so browsers never send it to any server or in a `Referer` header. The reset page reads it with JavaScript and POSTs it.
   - The email is sent directly (not stored in the outbox; DATABASE_DESIGN §3.6) to the **registered** address only. The request body's address is used for lookup, never as the recipient.
3. **Confirm.** `POST /api/auth/password-reset/confirm {token, newPassword}`. A token that is valid, unexpired and unused:
   - sets the new Argon2id hash
   - marks the token used
   - **deletes all sessions**
   - logs an `auth` activity entry
   - sends a "your password was changed" notice to the registered address

   Anything else → `400 INVALID_OR_EXPIRED_TOKEN`, with the same response for unknown, expired and used tokens.
4. **The user isn't logged in automatically** after a reset. They sign in with the new password, which confirms it works.
5. **Logs** never contain the token. Redaction covers `token`, and the reset page uses `Referrer-Policy: no-referrer`.

**Fallback and future work:**
- **Emergency fallback:** `npm run admin:set-password`, for when email is broken or the mailbox is lost. It needs database access, so only developers can use it.
- **MFA (TOTP):** recommended as a future enhancement. It is not in the frontend, so it's not planned.
- **Why email reset is acceptable here:** an attacker who controls the admin's mailbox can take over the site. Protect the Workspace account with 2-Step Verification, which the Gmail app password requires anyway (INTEGRATIONS §3).

---

## 3. Passwords and brute-force protection

### Hashing

- **Argon2id via Node's built-in `crypto.argon2`**: present since v24.7.0, **stable** since v24.19.0 (VERIFIED, Node changelog). This adds no native dependency.
  - **Node floor `>=24.19.0`.** The local toolchain is v24.15.0 and must be upgraded. Render's current default is 24.22.1 (VERIFIED).
- **Parameters:** OWASP minimum for Argon2id is **m = 19 MiB (19456 KiB), t = 2, p = 1** (VERIFIED, OWASP Password Storage Cheat Sheet). Plus a 16-byte random salt and a 32-byte tag.
- **Stored format:** PHC string (`$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>`), so parameters can be raised later and re-hashed on next login.

### Password policy (PROPOSED)

- 12–128 characters, no composition rules.
- Rejected if it matches the account email or one of a short bundled list of very common passwords.

### Brute force

| Control | Setting |
|---|---|
| Per-IP limit on login | 10 **failed** attempts / 15 min → `429` with `Retry-After`. Successful sign-ins don't count; wrong current passwords on `POST /api/auth/password` do (as built) |
| Per-account lock | After 10 consecutive failures, `lockedUntil = now + 15 min`; reset on success |
| Response on lock | Same generic `401 INVALID_CREDENTIALS` as a wrong password, so attackers can't confirm the account exists. The real reason goes to the activity log (`auth` kind) |
| Timing | If the email doesn't exist, still verify against a fixed dummy Argon2id hash, so response time doesn't reveal valid emails |

**Accepted trade-off:** someone who knows the admin email can trigger 15-minute lockouts. The per-IP limit slows this, and the lock is short. The login email should not be the public `info@` address: **decided 2026-11-21, the admin signs in with `dev@manidevelopment.ge`** (U-18).

---

## 4. Authorization and access control

- **One admin role** (one admin account for now, Q-06 decided).
- **Secure by default:**
  - All admin routes are mounted on one router: `app.use('/api/admin', requireAdmin, adminRouter)`. A new admin route cannot accidentally be public.
  - A test walks the Express route table and asserts that every `/api/admin/*` route returns `401` without a session (TESTING_STRATEGY §4).
- **Public data is opt-in, not opt-out.** Public endpoints use **separate serializers that list allowed fields** and **query-level filters**:

| Resource | Public filter |
|---|---|
| Projects | `isPublished = true` |
| Pages | `isPublished = true` (system pages always are) |
| Homepage slides | `isPublished = true` |
| Navigation | `visible = true` and the target page is published |
| Redirects | only through `resolve`, one path at a time |
| Services | `visible = true` |
| Team | `visible = true` |
| Testimonials | `published = true` |
| Settings | public fields only |
| Inquiries, notes, notifications, activity, media library, users | **never public** |

- **IDOR:** Admins may act on any record by design (single role). Public routes look up projects by `slug` and only among public rows; hidden or unpublished IDs are indistinguishable from non-existent ones (`404`).

---

## 5. CSRF and CORS

### CSRF

1. `SameSite=Strict` session cookie (§2).
2. **Origin check:** for `POST/PUT/PATCH/DELETE` on `/api/auth/*` and `/api/admin/*`, the `Origin` header must exactly match an entry in `CORS_ORIGINS`; otherwise `403 ORIGIN_NOT_ALLOWED`. This also stops attacks from sibling sub-domains, which count as same-site.
3. **JSON-only bodies:** unsafe requests must send `Content-Type: application/json`, otherwise `415`. Plain HTML forms can't send that without a CORS preflight.

### CORS (`cors` middleware, exact allow-list)

| Route group | Allowed origins | Credentials | Methods |
|---|---|---|---|
| `/api/auth/*`, `/api/admin/*` | `CORS_ORIGINS` | **yes** (`Access-Control-Allow-Credentials: true`; wildcard forbidden, VERIFIED MDN) | GET, POST, PUT, PATCH, DELETE |
| `/api/public/*` | `CORS_ORIGINS` | no | GET, POST (inquiries only) |
| `/api/health/*` | none needed (Render probe, server-side) | no | GET |

---

## 6. Input validation and injection

- **Every request body, path parameter and query string** is parsed with a Zod 4 schema (`zod@4.x` is stable, VERIFIED).
  - Objects are `.strict()`: unknown keys give `400`.
  - Strings are trimmed with min/max lengths (DATABASE_DESIGN §3).
  - Enums are checked; dates are `YYYY-MM-DD`; UUIDs are validated.
- **SQL injection:** all queries go through the Prisma client (parameterized). `$queryRawUnsafe` / `$executeRawUnsafe` are **banned** (ESLint rule plus a grep check in CI). `$queryRaw` is allowed only as a tagged template.
- **URLs stored for public `href`s** (social links) must parse with `new URL()` and use `https:` or `http:` (the frontend allows `https?://`, `SettingsAdmin.tsx:17`). This blocks `javascript:` and `data:` links.
- **Slugs:** `^[a-z0-9]+(-[a-z0-9]+)*$`, enforced in Zod **and** as a database `CHECK`.
- **Email header injection:** values used in email headers (subject, reply-to, name) are rejected if they contain CR/LF (INTEGRATIONS §3.3).
- **Body limits:** `express.json({ limit: '100kb', strict: true })`. Larger payloads get `413`. File bytes never pass through the API (Cloudflare direct upload).
- **Query parsing:** Express 5 defaults to the "simple" query parser (VERIFIED), so no nested-object query parsing.

---

## 7. XSS

**The API returns only JSON:**
- `Content-Type: application/json; charset=utf-8`
- `X-Content-Type-Options: nosniff` (helmet)

**Content fields are plain text, never HTML:**
- The frontend renders them through React, which escapes them. For example, descriptions are split on blank lines into `<p>` (`ProjectDetail.tsx:91-96`).
- The only `dangerouslySetInnerHTML` is a static theme script (`client/components/ui/InlineScript.tsx:16`).
- The rule for all future work: **never render API text as HTML**.

**Uploads:**
- SVG and GIF are excluded from the admin upload allow-list (INTEGRATIONS §1.3). Cloudflare also sanitizes SVGs.

**Frontend Content-Security-Policy:**
- `client/vercel.json` sets several security headers but **no CSP** today.
- The site's CSP is now designed in §17.4. The earlier idea of a nonce-based policy was dropped: Next.js documents that nonces are incompatible with this project's caching mode (INTEGRATIONS §10).

**Rich text, embeds and structured data** are new output paths added by the CMS scope. Their rules are in §17.

---

## 8. Logging, errors and information leakage

**Logging:**
- `pino` 10 + `pino-http` 11 (VERIFIED versions), JSON to stdout, collected by Render logs.
- **Request IDs:**
  - `genReqId` is `crypto.randomUUID()`. pino-http's default is an incrementing integer, which isn't unique across instances (VERIFIED).
  - The ID is returned as an `X-Request-Id` header and included in error bodies.

**Redaction (`redact` option, VERIFIED):**
- `req.headers.cookie`, `req.headers.authorization`, `res.headers["set-cookie"]`
- any `password`, `currentPassword`, `newPassword`, `token`, `secret` fields
- **Request bodies are not logged at all.** Inquiry content is personal data. Logs reference inquiries by ID only.

**Error handling:**
- One error middleware maps errors to `{ error: { code, message, details?, requestId } }`.
- `5xx` responses never include stack traces, SQL or upstream error text (logged server-side only).
- Express 5 forwards rejected promises from async handlers to the error middleware automatically (VERIFIED), so no wrapper library is needed.

**Other leakage controls:**
- `X-Powered-By` is removed (helmet).
- `404` is used for both "not found" and "not visible to you" on public routes.

---

## 9. Rate limiting and abuse

`express-rate-limit` 8.x (VERIFIED). The memory store is acceptable **because production runs a single instance**. Its docs warn that state isn't shared across instances; scaling out would require a shared store.

| Route | Limit (PROPOSED) | Key |
|---|---|---|
| `POST /api/auth/login` | 10 / 15 min | client IP |
| `POST /api/auth/password-reset/request` | 3 / hour per IP **and** 3 / hour per email | client IP; normalized email |
| `POST /api/auth/password-reset/confirm` | 10 / hour | client IP |
| `POST /api/public/inquiries` | 5 / hour and 20 / day | client IP |
| `GET /api/public/*` | 300 / min | client IP; **see note** |
| `/api/admin/*` | 600 / 15 min | session ID |
| Everything else | 120 / min | client IP |

- **Client IP:** determined according to the Phase 3 measurement (`trust proxy` hop count or `CF-Connecting-IP`; INTEGRATIONS §4). **BLOCKED** until measured. A wrong setting either rate-limits everyone together or lets attackers spoof IPs.
- **Note on public GETs:** most public reads will come from Vercel's servers during rendering (Phase 11), which share a small set of IPs. Server-side calls send `X-Internal-Key: <INTERNAL_API_KEY>` and are exempt from this limiter. Browser calls are limited normally.
- Responses use the `RateLimit` draft-8 headers (`standardHeaders: 'draft-8'`) and `Retry-After`.

---

## 10. HTTP security headers

- `helmet` 8.x defaults: CSP (harmless for JSON), HSTS (`max-age=31536000; includeSubDomains`), `nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, COOP and CORP `same-origin`, and removal of `X-Powered-By` (VERIFIED list).
- `Cache-Control: no-store` on every `/api/auth/*` and `/api/admin/*` response.
- **TLS:** Render terminates it with automatic certificates on custom domains (VERIFIED). The app trusts `X-Forwarded-Proto` only through the measured `trust proxy` setting.

---

## 11. Secrets management

- **Storage:** secrets live only in Render environment variables (a Render environment group per environment) and in each developer's local `.env`.
  - `.env*` stays git-ignored. The server's `.gitignore` copies the client's rule.
  - `.env.example` holds names and descriptions only.
- **No secret is ever in a `NEXT_PUBLIC_*` variable.** The only frontend public values are the API URL, the Cloudflare image account hash and the Turnstile site key.
- **Least privilege:**

| Secret | Scope |
|---|---|
| Cloudflare token | **Images Write only** |
| Database | Render's managed credentials; internal URL in production |
| SMTP | A dedicated website mailbox, not a person's |
| Revalidation | A random 32-byte secret, separate from the internal API key |

- **Rotation:** documented per secret in the Phase 16 runbook. Session tokens rotate naturally. The other secrets rotate with a dual-validity window where both sides support it (revalidation and internal key: accept old and new during the switch).

---

## 12. Upload security

- Only authenticated admins can request an upload URL. The URL is single-use and short-lived (2–5 minutes).
- **Server-side checks before issuing a URL:**
  - declared MIME type in the allow-list (JPEG, PNG, WebP, HEIC)
  - declared size ≤ 10 MB
  - dimensions within 1…12,000 px
- **After upload:** Cloudflare decodes and re-encodes the file. Non-images are rejected by Cloudflare itself (VERIFIED limits and format list).
- **The server never fetches or serves user-uploaded bytes**, so it can't be used for SSRF or as a malware relay.
- **Alt text** goes through the same validation as other text.

---

## 13. Dependencies and supply chain

- **Minimal production dependencies** (BACKEND_MASTER_PLAN §3.4):
  - `express`, `cors`, `helmet`, `express-rate-limit`, `zod`, `pino`, `pino-http`
  - `@prisma/client` + `@prisma/adapter-pg` + `pg`, `dotenv`
  - later: `nodemailer`
- **Exact versions pinned** with a committed `package-lock.json`, installed with `npm ci`. Prisma in particular must be pinned to `7.10.1`, because the CLI's `latest` tag points to an 8.0 release candidate (VERIFIED).
- **CI runs `npm audit --omit=dev --audit-level=high`.** Dependabot (GitHub) opens weekly update PRs, and each must pass the full test suite.
- **No install scripts from unknown packages.** New dependencies need a one-line justification in the PR.

---

## 14. Privacy

- **Inquiries** hold personal data. The design stores only what the form collects: no IP addresses, no user agent.
- **Retention:** Q-12 asks for a retention period. Once decided, a scheduled job (or documented manual step) deletes or anonymizes inquiries older than the period.
- **Visitor notice:** the contact form should state how the data is used. That copy is a business and legal decision; this plan gives no legal advice.
- **Turnstile** (if approved) loads a Cloudflare script on the contact page. That should be reflected in the site's privacy information.

---

## 15. Security verification (safe, authorized, repeatable)

| Check | How | When |
|---|---|---|
| Unauthenticated access | Route-table walker test: every admin route → 401 | Every CI run |
| Authorization of public data | Tests that hidden, unpublished and private records never appear in public responses | Every CI run |
| Validation | Table-driven invalid-payload tests per endpoint (wrong types, over-length, unknown keys, bad enums) | Every CI run |
| Session security | Cookie attributes, logout invalidation, expiry, password-change revocation, Origin check | Every CI run |
| Brute force and rate limits | Tests with a low test-configured limit | Every CI run |
| Injection | Tests posting SQL metacharacters and script tags, asserting they are stored and returned verbatim as data | Every CI run |
| Dependencies | `npm audit` + Dependabot | Every CI run / weekly |
| Banned APIs | grep for `$queryRawUnsafe`, `$executeRawUnsafe`, `eval(`, `dangerouslySetInnerHTML` (outside `InlineScript`) | Every CI run |
| Dynamic scan | **OWASP ZAP baseline (passive) scan against staging only**, with your approval | Phase 15 |
| Header check | Inspect response headers on staging and production with `curl -I` | Phases 15, 16 |
| Manual review | Read the auth, session and upload code against this plan | Phase 15 |

**No scans or load tests are run against production** without your explicit approval for that specific run.

---

## 16. Threat → control → test map

| Threat (from the brief) | Controls | Verified by |
|---|---|---|
| SQL injection | Prisma parameterization; unsafe raw APIs banned | §15 injection tests, grep |
| XSS | JSON only, React escaping, no HTML fields, URL scheme checks, no SVG | Injection tests, frontend review |
| CSRF | SameSite=Strict, Origin check, JSON-only | Origin and content-type tests |
| Broken authentication | Argon2id, DB sessions, lockout, generic errors, rotation; reset tokens hashed, 30-min, single-use, fragment-only, sessions revoked on reset | Session and reset test suites |
| Broken access control / IDOR | Single admin router guard, field-listing serializers | Route walker, public-filter tests |
| Unsafe uploads | Direct-to-Cloudflare, allow-list, decode validation, short URLs | Upload flow tests (fake provider) + staging spike |
| Credential exposure | Env-only secrets, redaction, least-privilege tokens | Log redaction test, review |
| Brute force | IP limits, account lock, constant-time paths | Rate-limit tests |
| Excessive requests | Rate limits, body limits, pagination caps | Tests |
| Information leakage | Uniform error shape, no stacks, 404 masking | Error tests |
| Misconfigured CORS | Exact allow-list, credentials only where needed | CORS tests |
| Insecure headers | helmet, `no-store`; site CSP (§17.4) | Header tests |
| Dependency vulnerabilities | Pinning, audit, Dependabot | CI |
| Stored XSS through CMS content | Rich text as allow-listed JSON, embeds as provider + ID, URL scheme checks (§17.1–17.2) | Block validation tests; renderer tests |
| Open redirect | Internal-only redirect and preview targets (§17.3) | Redirect and preview tests |
| Draft content leak | Drafts only with the internal key in Draft Mode; one-time preview tokens (§17.3) | Preview tests; public-filter tests |

---

## 17. Security of the CMS, SEO and analytics features (added 2026-11-20)

### 17.1 Rich text (CR-CMS-05, "output sanitization")

- **Stored as structured JSON, never as HTML.** The editor (Tiptap, Q-22) saves a document tree. Its vendor's own guidance is "You should always validate user input" (VERIFIED, INTEGRATIONS §11 sources).
- **Server-side allow-list** on every save (API_CONTRACTS §8.1): a recursive Zod schema that accepts only the listed node and mark types, with limits on depth, text length and node count. Unknown node types, marks or attributes are rejected, not stripped.
- **Links:** `href` must parse as a URL with scheme `https:`, `http:`, `mailto:` or `tel:`, or be an internal path with a single leading `/`. `javascript:`, `data:` and protocol-relative `//` values are rejected.
  - This check is ours. The editor's built-in link filtering only applies when the editor itself renders (VERIFIED from its published source), and the public site doesn't use the editor to render.
- **Rendering:** a small renderer in the site maps each allowed node to a React element. It never uses `dangerouslySetInnerHTML`. External links get `rel="noopener noreferrer"`.
- The editor is an **admin-only** dependency, loaded only on editing screens.

### 17.2 Embeds, video and third-party links

- **Embeds are provider + video ID.** The server parses the pasted address with `new URL()`, accepts only known YouTube and Vimeo host and path shapes, and extracts an ID that must match a strict pattern (letters, digits, `_`, `-` for YouTube; digits for Vimeo). No pasted HTML or iframe code is ever accepted.
- The site builds the player address itself: `youtube-nocookie.com/embed/<id>` or `player.vimeo.com/video/<id>?dnt=1`. The iframe gets a `title`, `loading="lazy"`, `referrerpolicy="strict-origin-when-cross-origin"` and a minimal `allow` list.
- **Uploaded video** follows the image rules in §12, with these differences:
  - allow-listed types: MP4, QuickTime, WebM
  - size ≤ 200 MB, duration ≤ 10 minutes
  - a Stream token scoped to Stream only
  - `allowedOrigins` set per video to the site's hosts
- **Settings-driven links** (WhatsApp number, Messenger username, map URL, navigation URLs, slide buttons) are format-checked on save (DATABASE_DESIGN §3.8), and the site builds the final `wa.me` / `m.me` address from the checked value. Navigation and button URLs must be internal paths or `https:`.
- **Tag Manager ID and Search Console token** are format-checked (`GTM-[A-Z0-9]+`; letters, digits, `_`, `-`).
  - Accepted risk: whoever controls the Tag Manager container can run scripts on the site. That is inherent in using Tag Manager; the container should be owned by the client and protected with 2-Step Verification.

### 17.3 Redirects and preview

- **Redirect targets are internal paths only** (one leading `/`, no `//`, no scheme). A redirect can never send a visitor to another site.
- **`/api/public/resolve`** returns only whether a path is a published project or page, or a redirect. It never reveals drafts.
- **Preview tokens:** 32 random bytes, stored hashed, valid 5 minutes, **single use**, issued only to a signed-in admin, and bound to one record.
- **Draft Mode is switched on only after the website's server has verified the token with the API**, and the page it redirects to comes from the API, not from the link (Next.js's own guidance, VERIFIED).
- **Drafts leave the API only** for requests that carry the internal key **and** ask for preview. The browser never holds that key.
- The Draft Mode cookie lasts for the browser session and changes on every site deployment (VERIFIED). A "Leave preview" button clears it.

### 17.4 Site Content-Security-Policy (static header)

Sent by the Next.js site (not the API), first in report-only mode on staging, then enforced.

| Directive | Value (PROPOSED; confirmed against real traffic on staging) |
|---|---|
| `default-src` | `'self'` |
| `script-src` | `'self' 'unsafe-inline' https://www.googletagmanager.com https://challenges.cloudflare.com` |
| `style-src` | `'self' 'unsafe-inline'` |
| `img-src` | `'self' data: https://imagedelivery.net https://*.cloudflarestream.com https://i.ytimg.com https://i.vimeocdn.com https://www.googletagmanager.com https://*.google-analytics.com` |
| `frame-src` | `https://www.youtube-nocookie.com https://player.vimeo.com https://*.cloudflarestream.com https://challenges.cloudflare.com` |
| `connect-src` | `'self' https://api.manidevelopment.ge https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://upload.imagedelivery.net https://*.cloudflarestream.com https://upload.cloudflarestream.com` |
| `font-src` | `'self'` |
| `object-src` | `'none'` |
| `base-uri` | `'self'` |
| `form-action` | `'self'` |
| `frame-ancestors` | `'self'` |

- **Why `'unsafe-inline'` for scripts:** the site has an inline theme script, Tag Manager needs an inline snippet, and a nonce-based policy is incompatible with this project's caching mode (VERIFIED, INTEGRATIONS §10).
  - The policy still blocks scripts, frames and connections from any host not listed, plus plugins and base-tag tricks.
  - Next.js's hash-based alternative is experimental (VERIFIED), so it's a future option, not MVP.
- The exact host list for Google Analytics, the Cloudflare upload hosts and the video poster images is **NOT VERIFIED**. Report-only mode on staging shows what's actually needed before enforcement.

### 17.5 Analytics and privacy

- No Google script loads before the visitor accepts (SEO_ANALYTICS_PERFORMANCE §9.4).
- Analytics events carry **no personal data**: only the method and placement of a click, or the fact that a form was sent. Names, emails, phone numbers and message text are never pushed to the data layer. A unit test on the `track()` helper enforces the allowed keys.
- Tag Manager is not loaded in the admin area at all.
