# Requirements Traceability Matrix

**Status:** Planning document, 2026-11-20. Maps every client requirement to where it stands today, where it is designed, and the phase that delivers and verifies it.

**How to read it:**
- **Today:** state of the current frontend, from the code audit ([FRONTEND_REQUIREMENTS_AUDIT.md](FRONTEND_REQUIREMENTS_AUDIT.md) §7). *Present* still means prototype-only, because all data is browser-local.
- **Design:** the section that specifies it.
- **Phase:** from the 16-phase roadmap ([BACKEND_MASTER_PLAN.md](BACKEND_MASTER_PLAN.md) §4). The first number builds it; a number in brackets verifies it.
- **Release:** **MVP** (first release) or **Future** (deliberately later).
- **Basis:**
  - **Verified:** the design rests on code evidence or official documentation.
  - **Assumed:** it rests on a stated assumption (EVIDENCE_REGISTER §7).
  - **Requires clarification:** it waits on an open question.

Short document names: DB = DATABASE_DESIGN, API = API_CONTRACTS, SEC = SECURITY_PLAN, INT = INTEGRATIONS, SAP = SEO_ANALYTICS_PERFORMANCE, TEST = TESTING_STRATEGY.

---

## 1. Public website

| ID | Requirement | Today | Design | Phase | Release | Basis |
|---|---|---|---|---|---|---|
| CR-PW-01 | Modern, minimalist, responsive corporate website | Present (design) | Existing frontend kept; SAP §8 | 11 (15) | MVP | Assumed (A-08: responsiveness not yet viewed running) |
| CR-PW-02 | Homepage with an admin-managed slider | Missing | DB §3.11; API §8.5; SAP §8 | 2, 8, 11, 12 | MVP | Requires clarification (Q-20) |
| CR-PW-03 | Contact information | Present | DB §3.8; API §5 | 8, 11 | MVP | Verified |
| CR-PW-04 | Clickable Google Maps location | Missing | DB §3.8 (`mapUrl`); SAP §10 | 8, 11 | MVP (link). Embedded map: Future | Verified (Maps URLs need no key); needs the link (Q-24) |
| CR-PW-05 | WhatsApp integration | Missing | DB §3.8; SAP §10 | 8, 11 | MVP | Verified; needs the number (Q-24) |
| CR-PW-06 | Facebook Messenger integration | Missing | DB §3.8; SAP §10 | 8, 11 | MVP | Requires clarification (Page username, Q-24; link behaviour tested in Phase 11) |
| CR-PW-07 | Direct-call integration | Present | SAP §10 | 11 | MVP | Verified |
| CR-PW-08 | Dynamic navigation | Missing | DB §3.10; API §8.4 | 2, 8, 11, 12 | MVP (flat menu). Dropdowns: Future | Requires clarification (Q-23) |
| CR-PW-09 | Dynamic product/project pages | Partial | DB §3.3, §3.9; API §5, §6.1, §8.1 | 7, 11 | MVP | Assumed (A-06: products = projects, Q-19) |

## 2. Content management system

| ID | Requirement | Today | Design | Phase | Release | Basis |
|---|---|---|---|---|---|---|
| CR-CMS-01 | Admin-managed homepage | Partial | Slider (DB §3.11), home page record with H1, intro, SEO and blocks (DB §3.9), featured projects (existing) | 6, 8, 12 | MVP: slider, heading, intro, SEO, blocks. Editing the designed sections' texts: Future | Requires clarification (Q-20, Q-21) |
| CR-CMS-02 | Admin-managed navigation | Missing | DB §3.10; API §8.4 | 8, 12 | MVP | Requires clarification (Q-23) |
| CR-CMS-03 | Admin-managed pages | Missing | DB §3.9; API §8.3 | 6, 11, 12 | MVP: custom block pages + editable heading, intro, SEO on existing pages | Assumed (A-07; Q-21) |
| CR-CMS-04 | Text, images, galleries, videos, embedded video links | Partial | Block types (DB §3.9; API §8.1); video (INT §11) | 5, 6, 11, 12 | MVP. Uploaded video needs Q-25 | Verified; uploaded video requires clarification (Q-25) |
| CR-CMS-05 | Flexible block-based page editor | Missing | DB §3.9; API §8.1; SEC §17.1 | 6, 12 | MVP: 6 block types. More types: Future | Requires clarification (Q-22 rich text) |
| CR-CMS-06 | Create, edit, delete, reorder, publish, unpublish | Partial | API §6, §8 (every type: CRUD; reorder for services, team, navigation, slides, blocks, gallery; publish for projects, pages, slides; show/hide for services, team, testimonials) | 6, 7, 8, 12 | MVP | Verified |
| CR-CMS-07 | Draft, preview and publishing workflow | Missing | DB §3.9 (publishing rules); API §8.8 (preview); SEC §17.3 | 6, 7, 11, 12 | MVP: draft, preview, publish. Version history and scheduled publishing: Future | Verified (Next.js Draft Mode) |
| CR-CMS-08 | Media library, secure uploads, automatic optimization | Partial | INT §1, §11; API §6.7; SEC §12 | 5, 12 | MVP | Verified; product approval pending (Q-04, Q-25) |
| CR-CMS-09 | Global company and contact settings | Present | DB §3.8; API §6.4 | 8, 12 | MVP | Verified |

## 3. SEO

| ID | Requirement | Today | Design | Phase | Release | Basis |
|---|---|---|---|---|---|---|
| CR-SEO-01 | Individual SEO title and meta description | Partial | DB §3.9 (shared SEO fields); API §8.2; SAP §2 | 2, 6, 7, 12, 13 | MVP | Verified |
| CR-SEO-02 | Editable URL slugs | Partial | DB §1 (transliteration), §3.3, §3.9; API §6.1, §8.3 | 2, 6, 7 | MVP | Verified |
| CR-SEO-03 | Editable H1 headings | Partial | H1 = the record's `title` (DB §3.9); SAP §3 | 6, 7, 13 | MVP | Verified |
| CR-SEO-04 | Correct H1/H2/H3 hierarchy | Partial | SAP §3; blocks limited to H2/H3 (API §8.1) | 6, 13 | MVP | Verified (the skip on the projects index is a known fix) |
| CR-SEO-05 | Canonical URLs | Partial | SAP §2 | 13 | MVP. Manual canonical override: Future | Verified |
| CR-SEO-06 | Open Graph metadata and social sharing images | Missing | DB §3.9 (`ogImageId`), §3.8 (default image); SAP §2 | 6, 7, 13 | MVP | Verified |
| CR-SEO-07 | Image alt text management | Partial (not used publicly) | DB §3.2; SAP §7 | 5, 11, 13 | MVP. Per-use alt overrides: Future | Verified |
| CR-SEO-08 | Automatically generated XML sitemap | Missing | API §8.7; SAP §4 | 6, 13 | MVP | Verified |
| CR-SEO-09 | Properly configured robots.txt | Missing | SAP §4 | 13 | MVP | Verified |
| CR-SEO-10 | Structured data / JSON-LD | Missing | SAP §5 | 13 | MVP: WebSite, GeneralContractor, BreadcrumbList. Opening hours, VideoObject: Future | Verified |
| CR-SEO-11 | Google Search Console verification support | Missing | DB §3.8 (token); SAP §2 | 8, 13 (16) | MVP | Verified; who verifies is Q-27 |
| CR-SEO-12 | Index/follow controls | Missing | DB §3.9 (`robotsIndex`, `robotsFollow`); SAP §2, §4 | 6, 7, 13 | MVP | Verified |
| CR-SEO-13 | Redirects when published URLs change | Missing | DB §3.12; API §8.6; SAP §6 | 2, 6, 11, 13 | MVP | Verified (Assumed A-09 for lookup speed) |
| CR-SEO-14 | Automatic SEO defaults with manual overrides | Partial | DB §3.9 (defaults table); API §8.2 | 6, 7 | MVP | Verified |
| CR-SEO-15 | Multilingual SEO architecture (only if required) | Partial | **Required**, because the site is bilingual. SAP §1, §2, §4 | 2, 11, 13 | MVP | Requires clarification (Q-02a, Q-32) |

## 4. Performance

| ID | Requirement | Today | Design | Phase | Release | Basis |
|---|---|---|---|---|---|---|
| CR-PERF-01 | Responsive across desktop, tablet, mobile | Present in code | TEST §10.5 | 11, 12 (15) | MVP | Assumed (A-08) |
| CR-PERF-02 | Core Web Vitals optimization | Not measured | SAP §8; TEST §10.4 | 11 (baseline), 14 | MVP | Verified (thresholds); results unknown until measured |
| CR-PERF-03 | Efficient media loading, caching, compression, formats | Partial | INT §1.5, §11; SAP §7 | 5, 11, 14 | MVP | Verified |
| CR-PERF-04 | Minimal JavaScript and dependencies | Partial | SAP §8; master plan §3.4 | 11, 14 | MVP | Requires clarification (Q-20: 3D house) |
| CR-PERF-05 | Efficient database queries and API responses | Missing | DB §6; INT §8 | 7–9 (15) | MVP | Verified |

## 5. Analytics

| ID | Requirement | Today | Design | Phase | Release | Basis |
|---|---|---|---|---|---|---|
| CR-AN-01 | Google Analytics 4 | Missing | SAP §9.1 | 14 | MVP | Verified; needs the account (Q-26) |
| CR-AN-02 | Google Tag Manager | Missing | SAP §9.1; DB §3.8 | 8, 14 | MVP | Verified; needs the container (Q-26) |
| CR-AN-03 | Tracking calls, WhatsApp, Messenger and other actions | Missing | SAP §9.2 | 14 | MVP | Verified |
| CR-AN-04 | Avoid duplicate analytics events | — | SAP §9.3; TEST §10.3 | 14 | MVP | Verified, except the click-trigger rule, which is our own (no official guidance) |
| CR-AN-05 | Consent / privacy requirements | Missing | SAP §9.4; SEC §17.5 | 14 | MVP | Requires clarification (Q-26: legal requirement and banner approval) |

## 6. Security and reliability

| ID | Requirement | Today | Design | Phase | Release | Basis |
|---|---|---|---|---|---|---|
| CR-SEC-01 | Secure administrator authentication | Missing (demo flag) | SEC §2, §3 | 4 | MVP. Two-step login (MFA): Future | Verified |
| CR-SEC-02 | Authorization, protected admin and API routes | Missing | SEC §4 | 4 (every later phase) | MVP | Verified |
| CR-SEC-03 | Input validation and output sanitization | Missing | SEC §6, §7, §17.1–17.2 | 1, 6 (every API phase) | MVP | Verified |
| CR-SEC-04 | Secure file uploads and media access | Missing | SEC §12, §17.2; INT §1, §11 | 5 | MVP | Verified |
| CR-SEC-05 | Rate limiting where appropriate | Missing | SEC §9 | 4, 9 | MVP | Verified design; client-IP detection is measured in Phase 3 |
| CR-SEC-06 | Secure HTTP headers and HTTPS | Partial (some site headers) | SEC §10, §17.4 | 1, 14 (15) | MVP | Verified; CSP host list confirmed on staging |
| CR-SEC-07 | Environment variable and secret management | Missing | SEC §11; INT §9 | 1, 3, 16 | MVP | Verified |
| CR-SEC-08 | Database backups and documented recovery | Missing | DB §9 | 3, 16 | MVP | Verified (Render paid plans) |
| CR-SEC-09 | Error handling, logging and monitoring | Missing | SEC §8; master plan §3.2 | 1, 16 | MVP. Error-tracking service: Future (Q-13) | Verified |
| CR-SEC-10 | Appropriate testing for critical functionality | Missing | TEST (all) | every phase | MVP | Verified |

---

## 7. First release (MVP) and later enhancements

**In the first release:** every row marked MVP above.

**Deliberately later, and why:**

| Enhancement | Why not now |
|---|---|
| Editing the texts inside the existing designed sections (figures, timeline, FAQ, values) | Each needs its own block type and form; the first release keeps those designs as they are (Q-21) |
| Version history and "draft of changes" for already-published content | Needs a revision model; draft → preview → publish covers new content |
| Scheduled publishing | Needs a scheduler; not requested |
| Dropdown menus | The design has a flat menu (Q-23) |
| Embedded interactive Google map | Needs a Google Cloud key; a clickable link meets the requirement without extra load time |
| Videos over 200 MB or 10 minutes | Needs resumable uploads |
| `VideoObject` and opening-hours structured data | No benefit for these page types yet; hours aren't machine-readable |
| Manual canonical override; per-use alt text | Automatic values are correct for a site of this shape |
| Two-step login, multiple roles, Georgian admin screens | One admin; not requested |
| Error-tracking service, automated performance checks in CI | Start with logs, uptime checks and recorded manual runs |

## 8. Gaps found in this review

**Features missing from the earlier plan** (now added):
1. Homepage slider, editable navigation, custom pages and the block editor.
2. Video (uploaded and embedded).
3. Draft, preview and publish for projects and pages.
4. The full SEO set: SEO fields, sitemap, robots, structured data, redirects, index controls, verification.
5. Analytics, click tracking and consent.
6. WhatsApp, Messenger and Google Maps links.

**Architectural gaps closed:**
1. **Real 404s and redirects.** With this project's caching mode, a "not found" decided inside a page returns status 200. The plan now decides in `proxy.ts` (SAP §6).
2. **Preview across two domains.** The admin's login cookie lives on the API domain, so the website can't see it. Preview uses a one-time token handed from the API to the website (API §8.8).
3. **Content safety.** Rich text and embeds are new ways for content to reach the page; both are stored as validated data, never HTML (SEC §17).
4. **Content-Security-Policy.** The earlier nonce idea is incompatible with this caching mode; replaced with a static policy (SEC §17.4).
5. **Language and URL structure.** Georgian-first addresses and the English-availability rule must be fixed before launch (SAP §1).
6. **Alt text.** The library's alt text wasn't reaching public pages (audit CR-SEO-07).
7. **Empty launch.** A site with zero projects could fail to build (INT §10).

**Corrections to earlier decisions:**
- Q-07: the earlier recommendation to skip SEO fields is withdrawn; the client requires them.
- Video was "only if confirmed"; it is now in scope.
- Media work moves before content work (master plan §4.1).
- `@next/third-parties` is not used (experimental); the standard Tag Manager snippet is.
