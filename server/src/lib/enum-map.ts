import type { InquiryStatus, ProjectStatus } from "../generated/prisma/enums.js";

/**
 * The database and API use the frontend's hyphenated values ("in-progress"), but Prisma's
 * generated TypeScript uses the schema names ("in_progress") — verified in Phase 2 (D-15).
 * Every conversion between the two goes through here.
 */
function enumMap<Internal extends string, Api extends string>(pairs: Record<Internal, Api>) {
  const reverse = new Map<string, Internal>(
    (Object.entries(pairs) as [Internal, Api][]).map(([internal, api]) => [api, internal]),
  );
  return {
    toApi: (value: Internal): Api => pairs[value],
    fromApi: (value: string): Internal | undefined => reverse.get(value),
    apiValues: Object.values(pairs) as Api[],
  };
}

export const projectStatus = enumMap<ProjectStatus, "planning" | "in-progress" | "completed" | "on-hold">({
  planning: "planning",
  in_progress: "in-progress",
  completed: "completed",
  on_hold: "on-hold",
});

export const inquiryStatus = enumMap<InquiryStatus, "new" | "in-progress" | "resolved">({
  new: "new",
  in_progress: "in-progress",
  resolved: "resolved",
});
