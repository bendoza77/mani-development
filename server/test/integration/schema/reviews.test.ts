import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";
import { createDatabase } from "../../../src/lib/db.js";
import { resetDb } from "../../helpers/db.js";

const db = createDatabase(inject("databaseUrl"));
const prisma = db.prisma;
afterAll(() => db.disconnect());
beforeEach(() => resetDb());

const base = { fullName: "Nino", text: "x".repeat(20), locale: "ka" };

describe("reviews", () => {
  it("defaults a new review to pending", async () => {
    const review = await prisma.review.create({ data: { ...base, rating: 5 } });
    expect(review.status).toBe("pending");
    expect(review.reviewedAt).toBeNull();
  });

  it.each([6, 0])("rejects rating %i at the database", async (rating) => {
    await expect(prisma.review.create({ data: { ...base, rating } })).rejects.toThrow(/reviews_rating_check/);
  });
});
