import { describe, expect, it } from "vitest";
import { pick, pickDoc, pickList } from "./media.serialize.js";

/** Russian falls back to English, then Georgian; English falls back to Georgian. */

describe("pick", () => {
  it("returns Russian for ru when it is set", () => {
    expect(pick("ქ", "E", "Р", "ru")).toBe("Р");
  });
  it("falls back from Russian to English", () => {
    expect(pick("ქ", "E", null, "ru")).toBe("E");
    expect(pick("ქ", "E", "", "ru")).toBe("E");
  });
  it("falls back from Russian to Georgian when English is empty too", () => {
    expect(pick("ქ", null, null, "ru")).toBe("ქ");
  });
  it("ignores Russian for the other languages", () => {
    expect(pick("ქ", "E", "Р", "en")).toBe("E");
    expect(pick("ქ", "E", "Р", "ka")).toBe("ქ");
    expect(pick("ქ", null, "Р", "en")).toBe("ქ");
  });
});

describe("pickList", () => {
  it("uses the first non-empty list along ru → en → ka", () => {
    expect(pickList(["ქ"], ["E"], ["Р"], "ru")).toEqual(["Р"]);
    expect(pickList(["ქ"], ["E"], [], "ru")).toEqual(["E"]);
    expect(pickList(["ქ"], [], [], "ru")).toEqual(["ქ"]);
    expect(pickList(["ქ"], ["E"], ["Р"], "en")).toEqual(["E"]);
    expect(pickList(["ქ"], ["E"], ["Р"], "ka")).toEqual(["ქ"]);
  });
});

describe("pickDoc", () => {
  it("uses the first document that exists along ru → en → ka", () => {
    expect(pickDoc({ k: 1 }, null, { r: 1 }, "ru")).toEqual({ r: 1 });
    expect(pickDoc({ k: 1 }, { e: 1 }, null, "ru")).toEqual({ e: 1 });
    expect(pickDoc({ k: 1 }, undefined, undefined, "ru")).toEqual({ k: 1 });
    expect(pickDoc({ k: 1 }, { e: 1 }, { r: 1 }, "en")).toEqual({ e: 1 });
  });
});
