import type { Express } from "express";
import request from "supertest";
import { ALLOWED_ORIGIN } from "./app.js";
import { post } from "./auth.js";

/** The 8-byte PNG signature plus a little padding: enough for the type check. */
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

/** Runs the whole local upload flow and returns the ready photo. */
export async function uploadImage(app: Express, cookie: string, filename = "house.png") {
  const start = await post(app, "/api/admin/media/uploads", { filename, mimeType: "image/png", bytes: PNG.length }, cookie);
  if (start.status !== 201) throw new Error(`upload start failed: ${start.status} ${JSON.stringify(start.body)}`);
  const path = new URL(start.body.uploadUrl as string).pathname;
  const sent = await request(app)
    .post(path)
    .set("Origin", ALLOWED_ORIGIN)
    .set("Cookie", cookie)
    .set("Content-Type", "image/png")
    .send(PNG);
  if (sent.status !== 204) throw new Error(`upload failed: ${sent.status} ${JSON.stringify(sent.body)}`);
  const done = await post(app, `/api/admin/media/${start.body.id}/complete`, { width: 1600, height: 900 }, cookie);
  if (done.status !== 200) throw new Error(`complete failed: ${done.status} ${JSON.stringify(done.body)}`);
  return done.body as { id: string; src: string };
}

export function projectInput(coverId: string, overrides: Record<string, unknown> = {}) {
  return {
    slug: "vake-house",
    titleKa: "ვაკის სახლი",
    titleEn: "Vake House",
    summaryKa: "ორსართულიანი სახლი",
    summaryEn: "",
    descriptionKa: "აღწერა",
    descriptionEn: null,
    locationKa: "ვაკე",
    cityKa: "თბილისი",
    cityEn: "Tbilisi",
    category: "residential",
    status: "in-progress",
    progress: 40,
    startDate: "2026-03-01",
    estimatedCompletion: "2027-06-30",
    completionDate: null,
    featured: false,
    architect: "N. Beridze",
    coverId,
    galleryIds: [],
    specs: [{ labelKa: "ფართი", labelEn: "Area", valueKa: "240 მ²" }],
    isPublished: true,
    ...overrides,
  };
}

export const paragraph = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
