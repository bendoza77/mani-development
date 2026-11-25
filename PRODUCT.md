# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Private houses come first (confirmed 2026-11-26). The site leads with them; the other two groups must still find their way easily, without being treated as an afterthought.

- **Primary: people building a private house**: they own or are buying a plot (city plots, hillside or vineyard sites) and want one firm to plan, engineer and build their home.
- **Secondary: apartment buyers**: people looking at flats in MANI's own buildings and developments.
- **Secondary: businesses**: companies that need offices or other workplaces built.

The second audience is the company's single admin, who edits the site's content, slider, projects, reviews and inquiries in the CMS (`/admin`).

## Product Purpose

The corporate website for MANI DEVELOPMENT, a design-and-build construction company in Tbilisi, Georgia (`manidevelopment.ge`). It shows the company's work, explains how it works, and turns visitors into inquiries through the contact form, phone, WhatsApp and Messenger. Success means a visitor in any of the three groups trusts the company enough to get in touch.

## Positioning

One team plans, engineers and builds, under one roof. A single project lead stays with the client from the first footing to handover, and the people who quote the job are the people who build it. Confirmed by the user as the main thing that sets MANI apart.

## Operating Context

- Content is Georgian first, with English and Russian versions (`client/i18n/locales/ka|en|ru`). Georgian text runs longer and uses its own script; every layout must hold all three.
- Visitors reach out by contact form, direct phone call, WhatsApp, Messenger, or by finding the office on Google Maps.
- Visitors can leave a review on the home page; it shows only after the admin approves it.
- The home page keeps its 3D house opening and a separate featured-work slider.

## Capabilities and Constraints

- Public site: home, about, services, projects (list and detail), contact, plus CMS-built pages (`/[slug]`) made from content blocks.
- CMS: pages, projects, services, team, testimonials, reviews, slider, navigation, redirects, media, settings, inquiries inbox.
- Stack: Next.js 16 + Tailwind 4 client on Vercel; Express + PostgreSQL (Prisma) API on Render, Frankfurt. Images on Cloudflare Images.
- Speed targets on mobile: LCP ≤ 2.5 s, CLS ≤ 0.1, Total Blocking Time ≤ 200 ms.
- Analytics load only after the visitor consents.
- Not live yet; staging is waiting on hosting accounts.

## Brand Commitments

- Company name is written **MANI DEVELOPMENT**.
- The existing copy speaks plainly and honestly ("Say what it will cost", "Draw it before you pour it", "Build fewer things, build them properly"). Keep that voice: concrete, modest, no hype.

## Evidence on Hand

- **Real:** company name, office address and email (`info@`).
- **Placeholder, must not be presented as fact:** every company figure (founded 2009, 17 years, 64 buildings, 310k m², 24 engineers, five regions), the founder name and quote, team members, projects, testimonials, phone number and opening hours. Real versions will come from the client through the CMS. The owner chose (2026-11-26) to keep the placeholder figures visible on Home and About until launch; they must be replaced before going live.
- Photos in `client/public/images` are stand-ins until the client supplies project photography.
- Do not invent further numbers, awards, clients, reviews or certifications.

## Product Principles

1. **Houses first, no one shut out.** Lead with private houses; an apartment buyer or a business should still find their path within one or two steps.
2. **Prove the one-team promise.** Show the plan-engineer-build process and the single project lead, rather than just claiming them.
3. **Georgian first.** Design and test in Georgian, then check English and Russian.
4. **Only real facts.** Placeholders stay clearly replaceable; nothing fabricated ships as truth.
5. **Make contact easy.** Every page offers a short path to a call, message or inquiry.

## Accessibility & Inclusion

No formal standard has been set. Existing work already supports reduced motion and keyboard and screen-reader use for carousels; keep that bar.
