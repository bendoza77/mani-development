import { describe, expect, it } from "vitest";
import { InquiryStatus, ProjectStatus } from "../generated/prisma/enums.js";
import { inquiryStatus, projectStatus } from "./enum-map.js";

describe("projectStatus", () => {
  it("maps every database value to the frontend's spelling", () => {
    expect(Object.values(ProjectStatus).map(projectStatus.toApi)).toEqual([
      "planning",
      "in-progress",
      "completed",
      "on-hold",
    ]);
  });

  it("round-trips every value", () => {
    for (const value of Object.values(ProjectStatus)) {
      expect(projectStatus.fromApi(projectStatus.toApi(value))).toBe(value);
    }
  });

  it("lists the API values for validation", () => {
    expect(projectStatus.apiValues).toEqual(["planning", "in-progress", "completed", "on-hold"]);
  });

  it("rejects values the API doesn't use, including the internal spelling", () => {
    expect(projectStatus.fromApi("in_progress")).toBeUndefined();
    expect(projectStatus.fromApi("cancelled")).toBeUndefined();
  });
});

describe("inquiryStatus", () => {
  it("maps and round-trips every value", () => {
    expect(Object.values(InquiryStatus).map(inquiryStatus.toApi)).toEqual(["new", "in-progress", "resolved"]);
    for (const value of Object.values(InquiryStatus)) {
      expect(inquiryStatus.fromApi(inquiryStatus.toApi(value))).toBe(value);
    }
  });
});
