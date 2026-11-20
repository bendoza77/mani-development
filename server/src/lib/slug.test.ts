import { describe, expect, it } from "vitest";
import { isReservedSlug, isValidSlug, slugify, transliterateGeorgian } from "./slug.js";

describe("transliterateGeorgian", () => {
  it("maps all 33 letters of the modern alphabet (national romanization)", () => {
    expect(transliterateGeorgian("აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ")).toBe(
      "abgdevztiklmnopzhrstupkghqshchtsdztschkhjh",
    );
  });

  it("leaves Latin text, digits and punctuation alone", () => {
    expect(transliterateGeorgian("Vake 2025, Tbilisi!")).toBe("Vake 2025, Tbilisi!");
  });
});

describe("slugify", () => {
  it.each([
    ["ვაკის ტერასები", "vakis-terasebi"],
    ["Vake Terraces", "vake-terraces"],
    ["  Shoreline   Residences  ", "shoreline-residences"],
    ["ვილა — Kakheti 2025", "vila-kakheti-2025"],
    ["Café & Façade", "cafe-facade"],
    ["!!!", ""],
  ])("turns %j into %j", (input, slug) => {
    expect(slugify(input)).toBe(slug);
  });

  it("handles Georgian capital letters (Mtavruli)", () => {
    expect(slugify("ᲕᲐᲙᲔ")).toBe("vake");
  });

  it("limits slugs to 80 characters without a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(79)} bcd`);

    expect(slug).toBe("a".repeat(79));
    expect(slug.length).toBeLessThanOrEqual(80);
  });

  it("always produces a valid slug or an empty string", () => {
    for (const input of ["ვაკის ტერასები", "A--B", "-x-", "ŞİŞLİ"]) {
      const slug = slugify(input);
      expect(slug === "" || isValidSlug(slug)).toBe(true);
    }
  });
});

describe("isValidSlug", () => {
  it.each(["vake", "vake-terraces", "a1-b2", "x"])("accepts %j", (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each(["", "Vake", "vake--terraces", "-vake", "vake-", "vake terraces", "ვაკე", "a".repeat(81)])(
    "rejects %j",
    (slug) => {
      expect(isValidSlug(slug)).toBe(false);
    },
  );
});

describe("isReservedSlug", () => {
  it.each(["admin", "api", "en", "ka", "projects", "services", "about", "contact", "home"])(
    "reserves %j",
    (slug) => {
      expect(isReservedSlug(slug)).toBe(true);
    },
  );

  it("allows ordinary page slugs", () => {
    expect(isReservedSlug("privacy-policy")).toBe(false);
  });
});
