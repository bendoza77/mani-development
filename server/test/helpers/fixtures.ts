import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client.js";

/**
 * Minimal valid rows for tests. Each builder accepts overrides; anything a test doesn't
 * care about gets a sensible default. Unique values use a random suffix.
 */

const unique = () => randomUUID().slice(0, 8);

export function media(prisma: PrismaClient, data: Partial<Prisma.MediaAssetUncheckedCreateInput> = {}) {
  const key = unique();
  return prisma.mediaAsset.create({
    data: {
      provider: "STATIC",
      providerKey: `/images/test-${key}.jpg`,
      status: "READY",
      filename: `test-${key}.jpg`,
      altKa: "სატესტო სურათი",
      width: 1600,
      height: 1067,
      bytes: 250_000,
      mimeType: "image/jpeg",
      ...data,
    },
  });
}

export async function project(prisma: PrismaClient, data: Partial<Prisma.ProjectUncheckedCreateInput> = {}) {
  const coverId = data.coverId ?? (await media(prisma)).id;
  return prisma.project.create({
    data: {
      slug: `project-${unique()}`,
      titleKa: "სატესტო პროექტი",
      summaryKa: "მოკლე აღწერა სატესტო პროექტისთვის",
      descriptionKa: "სრული აღწერა სატესტო პროექტისთვის, რამდენიმე წინადადებით.",
      locationKa: "ვაკე, თბილისი",
      cityKa: "თბილისი",
      category: "residential",
      status: "planning",
      progress: 10,
      startDate: new Date("2026-01-01"),
      estimatedCompletion: new Date("2027-01-01"),
      ...data,
      coverId,
    },
  });
}

export function page(prisma: PrismaClient, data: Partial<Prisma.PageUncheckedCreateInput> = {}) {
  return prisma.page.create({
    data: { slug: `page-${unique()}`, titleKa: "სატესტო გვერდი", ...data },
  });
}

export function inquiry(prisma: PrismaClient, data: Partial<Prisma.InquiryUncheckedCreateInput> = {}) {
  return prisma.inquiry.create({
    data: {
      name: "Natia Gogoladze",
      email: "natia@example.com",
      subject: "Family house",
      message: "We own a plot and would like to discuss a family house.",
      ...data,
    },
  });
}

export function adminUser(prisma: PrismaClient, data: Partial<Prisma.AdminUserUncheckedCreateInput> = {}) {
  return prisma.adminUser.create({
    data: {
      email: `admin-${unique()}@manidevelopment.ge`,
      name: "Test Admin",
      passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$placeholder$placeholder",
      ...data,
    },
  });
}
