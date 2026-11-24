import { Router } from "express";
import { z } from "zod";
import type { Config } from "../../config/env.js";
import type { MediaAsset, PrismaClient, SiteSettings } from "../../generated/prisma/client.js";
import { recordActivity } from "../../lib/activity.js";
import { parse } from "../../lib/validate.js";
import { assertReadyImages, localeQuery, optionalText } from "../content/fields.js";
import { pick, toImage } from "../media/media.serialize.js";

/** The single site-settings row (docs/API_CONTRACTS.md §6.4, docs/DATABASE_DESIGN.md §3.8). */

/** "" switches a feature off; anything else must match the format. */
const emptyOr = (rule: z.ZodString) => z.union([z.literal(""), rule]).default("");

const MAP_HOSTS = new Set(["maps.google.com", "www.google.com", "google.com", "maps.app.goo.gl", "goo.gl"]);
const isGoogleMapsUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !MAP_HOSTS.has(url.hostname)) return false;
    if (url.hostname === "maps.google.com" || url.hostname === "maps.app.goo.gl") return true;
    return url.pathname.startsWith("/maps");
  } catch {
    return false;
  }
};

const socialUrl = emptyOr(z.string().trim().max(300).regex(/^https?:\/\/[^\s/]+\.[^\s]+$/, "invalid_url"));

const settingsInput = z.strictObject({
  companyName: z.string().trim().min(2).max(24),
  taglineKa: z.string().trim().max(40),
  taglineEn: optionalText(40),
  taglineRu: optionalText(40),
  email: z.email().max(254),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[\d\s+()-]+$/, "invalid_phone")
    .refine((v) => v.replace(/\D/g, "").length >= 7, { message: "invalid_phone" }),
  addressKa: z.string().trim().min(5).max(200),
  addressEn: optionalText(200),
  addressRu: optionalText(200),
  hoursKa: z.string().trim().max(100),
  hoursEn: optionalText(100),
  hoursRu: optionalText(100),
  instagramUrl: socialUrl,
  linkedinUrl: socialUrl,
  facebookUrl: socialUrl,
  whatsappNumber: emptyOr(z.string().trim().regex(/^\d{8,15}$/, "invalid_whatsapp")),
  messengerUsername: emptyOr(z.string().trim().max(100).regex(/^[A-Za-z0-9.]+$/, "invalid_username")),
  mapUrl: emptyOr(z.string().trim().max(500).refine(isGoogleMapsUrl, { message: "not_google_maps" })),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
  defaultSeoDescriptionKa: z.string().trim().max(300).default(""),
  defaultSeoDescriptionEn: optionalText(300),
  defaultSeoDescriptionRu: optionalText(300),
  defaultOgImageId: z.uuid().nullable().default(null),
  googleSiteVerification: emptyOr(z.string().trim().max(100).regex(/^[A-Za-z0-9_-]+$/, "invalid_token")),
  gtmContainerId: emptyOr(z.string().trim().max(20).regex(/^GTM-[A-Z0-9]+$/, "invalid_gtm_id")),
});

type Row = SiteSettings & { defaultOgImage: MediaAsset | null };
const include = { defaultOgImage: true } as const;
const load = (prisma: PrismaClient) => prisma.siteSettings.findUniqueOrThrow({ where: { id: 1 }, include });

const toAdmin = (s: Row, config: Config) => {
  const { defaultOgImage, latitude, longitude, updatedAt, ...rest } = s;
  return {
    ...rest,
    id: undefined,
    latitude: latitude === null ? null : Number(latitude),
    longitude: longitude === null ? null : Number(longitude),
    defaultOgImage: defaultOgImage ? toImage(defaultOgImage, config) : null,
    updatedAt: updatedAt.toISOString(),
  };
};

export function adminSettingsRoutes({ config, prisma }: { config: Config; prisma: PrismaClient }) {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(toAdmin(await load(prisma), config));
  });

  router.put("/", async (req, res) => {
    const input = parse(settingsInput, req.body);
    if (input.defaultOgImageId) await assertReadyImages(prisma, [input.defaultOgImageId]);
    await prisma.siteSettings.update({ where: { id: 1 }, data: input });
    await recordActivity(prisma, { kind: "settings", message: "Site settings updated", actorId: req.session!.user.id });
    res.json(toAdmin(await load(prisma), config));
  });

  return router;
}

/** Everything the website needs to render; none of it is secret (contract §6.4). */
export function publicSettingsRoutes({ config, prisma }: { config: Config; prisma: PrismaClient }) {
  const router = Router();
  router.get("/", async (req, res) => {
    const { locale } = parse(localeQuery, req.query);
    const s = await load(prisma);
    res.json({
      companyName: s.companyName,
      tagline: pick(s.taglineKa, s.taglineEn, s.taglineRu, locale),
      email: s.email,
      phone: s.phone,
      address: pick(s.addressKa, s.addressEn, s.addressRu, locale),
      hours: pick(s.hoursKa, s.hoursEn, s.hoursRu, locale),
      instagramUrl: s.instagramUrl,
      linkedinUrl: s.linkedinUrl,
      facebookUrl: s.facebookUrl,
      whatsappNumber: s.whatsappNumber,
      messengerUsername: s.messengerUsername,
      mapUrl: s.mapUrl,
      latitude: s.latitude === null ? null : Number(s.latitude),
      longitude: s.longitude === null ? null : Number(s.longitude),
      defaultSeoDescription: pick(s.defaultSeoDescriptionKa, s.defaultSeoDescriptionEn, s.defaultSeoDescriptionRu, locale),
      defaultOgImage: s.defaultOgImage ? toImage(s.defaultOgImage, config, locale) : null,
      googleSiteVerification: s.googleSiteVerification,
      gtmContainerId: s.gtmContainerId,
    });
  });
  return router;
}
