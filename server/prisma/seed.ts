/**
 * Development seed: the prototype's PLACEHOLDER demo content (prisma/seed-data.json), Georgian first.
 * Never run against production (docs/DATABASE_DESIGN.md §8). Safe to run repeatedly: every row has a
 * stable id derived from the prototype's id, and rows are upserted.
 *
 * Run with `npx prisma db seed` (configured in prisma.config.ts).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import type { MediaCategory, PrismaClient, ProjectCategory } from "../src/generated/prisma/client.js";
import { createDatabase } from "../src/lib/db.js";
import { inquiryStatus, projectStatus } from "../src/lib/enum-map.js";
import { slugify } from "../src/lib/slug.js";

// ─── Seed data shape (as copied from the prototype) ───────────────────────

type Spec = { id: string; label: string; value: string };
type SeedProject = {
  id: string; slug: string; title: string; summary: string; description: string; location: string; city: string;
  category: ProjectCategory; status: string; progress: number; startDate: string; estimatedCompletion: string;
  completionDate?: string; featured: boolean; cover: string; gallery: string[]; specs: Spec[]; architect: string;
  updatedAt: string;
};
type SeedService = { id: string; title: string; summary: string; description: string; image: string; features: string[]; visible: boolean };
type SeedTeam = { id: string; name: string; role: string; bio: string; photo: string; visible: boolean };
type SeedTestimonial = { id: string; quote: string; author: string; role: string; project: string; published: boolean };
type SeedInquiry = {
  id: string; name: string; email: string; phone: string; subject: string; message: string; status: string;
  createdAt: string; notes: { id: string; text: string; createdAt: string }[];
};
type SeedMedia = { id: string; name: string; src: string; alt: string; category: MediaCategory; width: number; height: number; size: number; createdAt: string };
type Localized = Record<string, string | undefined>;
type SeedData = {
  media: SeedMedia[];
  projects: SeedProject[];
  services: SeedService[];
  team: SeedTeam[];
  testimonials: SeedTestimonial[];
  inquiries: SeedInquiry[];
  activity: { id: string; kind: string; message: string; at: string }[];
  notifications: { id: string; href: string; at: string; read: boolean }[];
  ka: {
    projects: Record<string, Localized & { specs?: { label: string; value: string }[] }>;
    services: Record<string, Localized & { features?: string[] }>;
    team: Record<string, Localized>;
    testimonials: Record<string, Localized>;
  };
  samplePage: {
    headingEn: string; headingKa: string; paragraphsEn: string[]; paragraphsKa: string[];
    imageCaptionEn: string; imageCaptionKa: string;
  };
  slideCta: { ka: string; en: string };
};

const data: SeedData = JSON.parse(readFileSync(new URL("./seed-data.json", import.meta.url), "utf8"));

// ─── Helpers ──────────────────────────────────────────────────────────────

/** A stable UUID (version 5 layout) for a prototype id, so re-running the seed updates instead of duplicating. */
function stableId(name: string): string {
  const hash = createHash("sha1").update(`mani-development-seed:${name}`).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const mediaIdBySrc = new Map(data.media.map((m) => [m.src, stableId(m.id)]));
function mediaId(src: string): string {
  const id = mediaIdBySrc.get(src);
  if (!id) throw new Error(`seed: no media row for ${src}`);
  return id;
}

/** Tiptap / ProseMirror document with plain paragraphs (the shape text blocks will use, API_CONTRACTS §8.1). */
const paragraphsDoc = (paragraphs: string[]) => ({
  type: "doc",
  content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
});

const DRAFT_PROJECTS = new Set(["p-gudauri-lodge"]);
const SLIDE_PROJECTS = ["p-vake-terraces", "p-mtatsminda-house", "p-batumi-shoreline"];
const SAMPLE_PAGE_SLUG = "sample-blocks";

// ─── Seed ─────────────────────────────────────────────────────────────────

export async function runSeed(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      for (const m of data.media) {
        const row = {
          provider: "STATIC" as const,
          providerKey: m.src,
          status: "READY" as const,
          filename: m.name,
          altKa: m.alt, // the prototype has English alt text only; Georgian alt text is entered in the admin
          altEn: m.alt,
          category: m.category,
          width: m.width,
          height: m.height,
          bytes: m.size,
          mimeType: "image/jpeg",
          createdAt: new Date(m.createdAt),
        };
        await tx.mediaAsset.upsert({ where: { id: stableId(m.id) }, create: { id: stableId(m.id), ...row }, update: row });
      }

      for (const p of data.projects) {
        const ka = data.ka.projects[p.id] ?? {};
        const status = projectStatus.fromApi(p.status);
        if (!status) throw new Error(`seed: unknown project status ${p.status}`);
        const published = !DRAFT_PROJECTS.has(p.id);
        const row = {
          slug: p.slug,
          titleKa: ka.title ?? p.title,
          titleEn: p.title,
          summaryKa: ka.summary ?? p.summary,
          summaryEn: p.summary,
          descriptionKa: ka.description ?? p.description,
          descriptionEn: p.description,
          locationKa: ka.location ?? p.location,
          locationEn: p.location,
          cityKa: ka.city ?? p.city,
          cityEn: p.city,
          category: p.category,
          status,
          progress: p.progress,
          startDate: new Date(p.startDate),
          estimatedCompletion: new Date(p.estimatedCompletion),
          completionDate: p.completionDate ? new Date(p.completionDate) : null,
          featured: p.featured,
          architect: p.architect,
          coverId: mediaId(p.cover),
          isPublished: published,
          publishedAt: published ? new Date(p.updatedAt) : null,
        };
        const id = stableId(p.id);
        await tx.project.upsert({ where: { id }, create: { id, ...row }, update: row });

        await tx.projectSpec.deleteMany({ where: { projectId: id } });
        await tx.projectSpec.createMany({
          data: p.specs.map((s, position) => ({
            id: stableId(s.id),
            projectId: id,
            position,
            labelKa: ka.specs?.[position]?.label ?? s.label,
            labelEn: s.label,
            valueKa: ka.specs?.[position]?.value ?? s.value,
            valueEn: s.value,
          })),
        });

        await tx.projectImage.deleteMany({ where: { projectId: id } });
        await tx.projectImage.createMany({
          data: p.gallery.map((src, position) => ({ projectId: id, mediaId: mediaId(src), position })),
        });
      }

      for (const [position, s] of data.services.entries()) {
        const ka = data.ka.services[s.id] ?? {};
        const row = {
          slug: slugify(s.title),
          titleKa: ka.title ?? s.title,
          titleEn: s.title,
          summaryKa: ka.summary ?? s.summary,
          summaryEn: s.summary,
          descriptionKa: ka.description ?? s.description,
          descriptionEn: s.description,
          featuresKa: ka.features ?? s.features,
          featuresEn: s.features,
          imageId: mediaId(s.image),
          visible: s.visible,
          position,
        };
        const id = stableId(s.id);
        await tx.service.upsert({ where: { id }, create: { id, ...row }, update: row });
      }

      for (const [position, m] of data.team.entries()) {
        const ka = data.ka.team[m.id] ?? {};
        const row = {
          nameKa: ka.name ?? m.name,
          nameEn: m.name,
          roleKa: ka.role ?? m.role,
          roleEn: m.role,
          bioKa: ka.bio ?? m.bio,
          bioEn: m.bio,
          photoId: mediaId(m.photo),
          visible: m.visible,
          position,
        };
        const id = stableId(m.id);
        await tx.teamMember.upsert({ where: { id }, create: { id, ...row }, update: row });
      }

      const projectIdByTitle = new Map(data.projects.map((p) => [p.title, stableId(p.id)]));
      for (const t of data.testimonials) {
        const ka = data.ka.testimonials[t.id] ?? {};
        const row = {
          quoteKa: ka.quote ?? t.quote,
          quoteEn: t.quote,
          authorKa: ka.author ?? t.author,
          authorEn: t.author,
          roleKa: ka.role ?? t.role,
          roleEn: t.role,
          projectId: projectIdByTitle.get(t.project) ?? null,
          published: t.published,
        };
        const id = stableId(t.id);
        await tx.testimonial.upsert({ where: { id }, create: { id, ...row }, update: row });
      }

      for (const q of data.inquiries) {
        const status = inquiryStatus.fromApi(q.status);
        if (!status) throw new Error(`seed: unknown inquiry status ${q.status}`);
        const row = {
          name: q.name,
          email: q.email,
          phone: q.phone || null,
          subject: q.subject,
          message: q.message,
          status,
          createdAt: new Date(q.createdAt),
        };
        const id = stableId(q.id);
        await tx.inquiry.upsert({ where: { id }, create: { id, ...row }, update: row });
        for (const n of q.notes) {
          const note = { inquiryId: id, text: n.text, createdAt: new Date(n.createdAt) };
          await tx.inquiryNote.upsert({ where: { id: stableId(n.id) }, create: { id: stableId(n.id), ...note }, update: note });
        }
      }

      // Only "new inquiry" notifications exist in the new design (DATABASE_DESIGN §3.6).
      for (const n of data.notifications) {
        const inquiry = /[?&]id=(q-\d+)/.exec(n.href)?.[1];
        if (!inquiry) continue;
        const row = { type: "NEW_INQUIRY" as const, inquiryId: stableId(inquiry), read: n.read, createdAt: new Date(n.at) };
        await tx.notification.upsert({ where: { id: stableId(n.id) }, create: { id: stableId(n.id), ...row }, update: row });
      }

      for (const a of data.activity) {
        const row = { kind: a.kind as "project", message: a.message, createdAt: new Date(a.at) };
        await tx.activityLog.upsert({ where: { id: stableId(a.id) }, create: { id: stableId(a.id), ...row }, update: row });
      }

      // Homepage slides reuse existing Georgian and English texts (project names and summaries).
      for (const [position, projectKey] of SLIDE_PROJECTS.entries()) {
        const p = data.projects.find((x) => x.id === projectKey)!;
        const ka = data.ka.projects[p.id] ?? {};
        const row = {
          imageId: mediaId(p.cover),
          headingKa: ka.title ?? p.title,
          headingEn: p.title,
          textKa: ka.summary ?? p.summary,
          textEn: p.summary,
          ctaLabelKa: data.slideCta.ka,
          ctaLabelEn: data.slideCta.en,
          ctaUrl: `/projects/${p.slug}`,
          isPublished: true,
          position,
        };
        const id = stableId(`slide-${projectKey}`);
        await tx.homeSlide.upsert({ where: { id }, create: { id, ...row }, update: row });
      }

      // A sample custom page with heading, text and image blocks.
      const sp = data.samplePage;
      const pageId = stableId(`page-${SAMPLE_PAGE_SLUG}`);
      const page = {
        kind: "CUSTOM" as const,
        slug: SAMPLE_PAGE_SLUG,
        titleKa: sp.headingKa,
        titleEn: sp.headingEn,
        isPublished: true,
        publishedAt: new Date("2026-11-20T00:00:00Z"),
        robotsIndex: false, // demo content must never be indexed
      };
      await tx.page.upsert({ where: { id: pageId }, create: { id: pageId, ...page }, update: page });
      await tx.contentBlock.deleteMany({ where: { pageId } });

      const blocks = [
        // Same stored shape as the pages API writes (src/modules/pages/pages.routes.ts blockData).
        { type: "heading" as const, data: { level: 2, textKa: sp.headingKa, textEn: sp.headingEn }, media: [] },
        { type: "text" as const, data: { docKa: paragraphsDoc(sp.paragraphsKa), docEn: paragraphsDoc(sp.paragraphsEn) }, media: [] },
        { type: "image" as const, data: { captionKa: sp.imageCaptionKa, captionEn: sp.imageCaptionEn }, media: ["/images/drawings.jpg"] },
        // Gallery blocks come later; the API doesn't accept them yet.
      ];
      for (const [position, b] of blocks.entries()) {
        const blockId = stableId(`${SAMPLE_PAGE_SLUG}-block-${position}`);
        await tx.contentBlock.create({ data: { id: blockId, pageId, position, type: b.type, data: b.data } });
        if (b.media.length) {
          await tx.contentBlockMedia.createMany({
            data: b.media.map((src, i) => ({ blockId, mediaId: mediaId(src), position: i })),
          });
        }
      }
    },
    { timeout: 60_000 },
  );
}

// ─── CLI entry (npx prisma db seed) ───────────────────────────────────────

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  dotenv.config({ quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to seed");
  const db = createDatabase(url);
  try {
    await runSeed(db.prisma);
    console.log("Seeded development data (placeholder demo content).");
  } finally {
    await db.disconnect();
  }
}
