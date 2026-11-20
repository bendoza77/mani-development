# Open Questions

Decisions the code and documentation can't settle. Each lists what is needed, why it matters, the options, a recommendation and what work depends on it.

**Priority:**
- **P0** blocks the database design (Phase 2).
- **P1** blocks a later phase.
- **P2** can be answered any time before launch.

Phase numbers refer to the 16-phase roadmap in [BACKEND_MASTER_PLAN.md](BACKEND_MASTER_PLAN.md) §4.

---

## Answered

| ID | Answer | What it means for the plan |
|---|---|---|
| Q-01 Domains | Domain is **`manidevelopment.ge`** (2026-11-20) | Site at `www.manidevelopment.ge`, API at `api.manidevelopment.ge` |
| Q-02 Georgian content | "Yes, we need mainly Georgian." | All content editable in Georgian and English, **Georgian primary**. Details remain in Q-02a |
| Q-03 Video | **Required** by the client requirements (uploaded videos and embedded links) | In scope. The cost of hosting uploaded video needs approval (Q-25) |
| Q-05 Email product | "It is Gmail (mail we bought)": Google Workspace via domenebi.ge. Mailboxes: `info@` and `dev@manidevelopment.ge` | Send through `smtp.gmail.com`. Which mailbox does what is Q-29 |
| Q-06 Admin accounts | One admin for now; forgotten password → reset link emailed to the registered address | Single role; email reset flow; command-line reset as emergency fallback |
| Q-07 Drafts and SEO fields | **Both required** by the client requirements (draft / preview / publish workflow; individual SEO title and description with automatic defaults) | Projects and pages get a Published switch, a preview link and optional SEO fields. This replaces the earlier recommendation to skip SEO fields |
| Q-08 Hosting | You will purchase the plans and share the resource details | Phase 3 starts once the accounts exist |
| Q-19 Products | "Skip it for now" (2026-11-20) | No separate product catalogue. Projects are the product pages. A catalogue can be added later as a new content type |
| Q-20 Slider | "No, just in another section" | The homepage keeps its current opening with the 3D house. The slider is a **separate section lower on the page**. The homepage heading (H1) stays in the opening |
| Q-21 Editable pages | Recommended option accepted | Hybrid: existing designs stay, with editable heading, intro, SEO and added blocks; new pages are built from blocks |
| Q-22 Text formatting | Yes | Bold, italic, links and lists in text blocks (Tiptap editor, admin only) |
| Q-02a Language | "Both is good, first Georgian" | Georgian required, English optional. `manidevelopment.ge/` opens in Georgian; English is at `/en/`. Admin screens stay English for launch (assumed; say if not) |
| Q-25 Video | Both options | Uploaded video on Cloudflare Stream (from $5/month) **and** YouTube/Vimeo links |
| Q-29 Mailboxes | `info@` | `info@manidevelopment.ge` is the admin login, the sending account and the inquiry inbox. It needs 2-Step Verification and an app password |
| Q-28 DNS | You manage DNS | You add the records when each phase needs them; exact values will be given then |

### Sharing resources safely

**Share in chat (not secret):** service names and region, domain names, the Cloudflare account ID and image "account hash", the Tag Manager ID, which email address sends.

**Never paste into chat or commit to Git (secret):** passwords and app passwords, API tokens, database connection URLs, any "secret key". Enter these directly in Render's and Vercel's settings, or in your local `server/.env`.

---

## P0 — needed before the database design is final (Phase 2)

Only two small confirmations remain. Both have a default that will be used unless you say otherwise.

### Q-32 · Pages without an English version
- **Decide:** If a project or page has no English text yet, what should the English site do?
  - **A (recommended):** it simply doesn't exist in English until an English title is entered (not listed; its English address is "not found").
  - **B:** the English address shows the Georgian text.
- **Why:** Google treats an English address showing Georgian text as a duplicate of the Georgian page (SEO_ANALYTICS_PERFORMANCE §1).
- **Default if not answered: A.**
- **Depends on it:** Phases 2, 6, 13.

### Q-23 · Navigation depth
- **Decide:** Is a flat menu enough (as today), or are dropdown sub-menus needed? Should the footer menu be editable too?
- **Default if not answered:** flat menu; header and footer both editable.
- **Depends on it:** Phase 2, Phase 8.

---

## P1 — needed before the phase noted

### Q-33 · Main address: with or without `www`? (before Phase 3)
- **Recommendation:** `https://www.manidevelopment.ge` as the main address, with `manidevelopment.ge` redirecting to it.

### Q-14 · Staging environment (before Phase 3)
- **Decide:** a permanent test copy (`staging.` and `api-staging.` sub-domains, separate service and database)?
- **Recommendation:** yes (about $13/month more on Render, or free tiers with their limits).

### Q-29 · Two email details (before Phase 10)
- Should visitors get an automatic "we received your message" email? **Recommendation: yes.**
- Who is the Google Workspace **super administrator**? They must turn on DKIM (email signing).

### Q-04 · Cloudflare Images for photos (before Phase 5)
- **Recommendation:** approve. About $5/month; 10 MB per file; automatic resizing and modern formats (INTEGRATIONS §1.3).

### Q-11 · Deleting an image or video that is in use (before Phase 5)
- **Recommendation:** block the delete and show where it is used.

### Q-24 · Contact buttons (before Phase 8)
- **Needed:** the WhatsApp number, the Facebook Page username for Messenger, and the office's Google Maps link (or its coordinates).
- **Decide:** where should the phone, WhatsApp and Messenger buttons appear: header, footer, contact page, a floating button on phones?
- **Recommendation:** contact page and footer always; one floating button on phones.

### Q-09 · Spam protection on the contact form (before Phase 9)
- **Recommendation:** Cloudflare Turnstile (free).

### Q-26 · Analytics accounts and consent (before Phase 14)
1. Who owns the **Google Analytics 4** property and the **Tag Manager** container? The client should create them, or give access, and share the Tag Manager ID.
2. **Consent banner:** load analytics only after the visitor accepts? **Recommendation: yes.** Whether Georgian law requires it is a legal question for the client; Google requires consent signals for visitors from the EU, UK and Switzerland.
3. **What to track:** phone, WhatsApp, Messenger, email and map clicks, plus contact-form submissions. Anything else?
4. Who writes the **privacy page** text?

### Q-27 · Google Search Console (before Phase 16)
- **Decide:** who registers the site in Search Console?
- **Options:** a DNS record (covers the whole domain; needs DNS access, Q-28) or a code pasted into the site settings (covers the `www` address).
- **Recommendation:** DNS record if DNS access is easy; otherwise the settings field.

### Q-31 · Any earlier website? (before Phase 13)
- **Found:** nothing is live on the domain now.
- **Decide:** was there an earlier site whose pages are still in Google or linked from elsewhere? If so, list its addresses so they can redirect to the new pages.

### Q-10 · Launch content (before Phase 16)
- **Decide:** start production empty (you enter real content), or load the placeholder projects, team and testimonials to edit?
- **Recommendation:** start empty, except the company settings.

---

## P2 — before launch

| ID | Question | Recommendation | Depends |
|---|---|---|---|
| Q-12 | How long should inquiries (personal data) be kept? | Pick a period (e.g. 24 months), then delete or anonymize older ones automatically | Phase 15 |
| Q-13 | Error monitoring service (e.g. Sentry), or Render logs only? | Render logs plus an uptime check at launch | Phase 16 |
| Q-15 | Node.js 24 or 26? | 24.x, at least 24.19; your local Node 24.15 needs updating | Phase 1 |
| Q-16 | Light/dark theme stays a per-browser preference? | Yes | Phase 11 |
| Q-17 | Allow Playwright (a test-only tool) for automated browser tests? | Yes | Phases 12, 15 |
| Q-18 | GitHub Actions for automated checks, Dependabot for updates? | Yes | Phase 1 |

---

## How answers are recorded

Each answer is copied into [EVIDENCE_REGISTER.md](EVIDENCE_REGISTER.md) as a **decision** (date and wording), and the affected design document is updated before the dependent phase starts.
