import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/app.js";
import { createTestAdmin, signIn } from "../../helpers/auth.js";
import { api, projectInput, uploadImage } from "../../helpers/content.js";
import { resetDb } from "../../helpers/db.js";

/** Phase 6: automatic redirects, path resolution and the sitemap feed (API_CONTRACTS §8.6–8.7). */

const { app, db, settle, close } = buildTestApp();
const prisma = db.prisma;
afterAll(close);
afterEach(settle);

let cookie: string;
let imageId: string;
beforeEach(async () => {
  await resetDb();
  await createTestAdmin(prisma);
  cookie = await signIn(app);
  imageId = (await uploadImage(app, cookie)).id;
});

const resolve = async (path: string) => (await request(app).get("/api/public/resolve").query({ path })).body;

const pageInput = (overrides: Record<string, unknown> = {}) => ({
  slug: "careers",
  titleKa: "ვაკანსიები",
  titleEn: null,
  introKa: "",
  isPublished: true,
  blocks: [],
  ...overrides,
});

async function createProject(overrides: Record<string, unknown> = {}) {
  return (await api(app, "post", "/api/admin/projects", cookie, projectInput(imageId, overrides))).body as { id: string };
}
const renameProject = (id: string, slug: string, overrides: Record<string, unknown> = {}) =>
  api(app, "put", `/api/admin/projects/${id}`, cookie, projectInput(imageId, { slug, ...overrides }));

describe("automatic redirects", () => {
  it("redirects the old address when a published project's slug changes", async () => {
    const project = await createProject({ slug: "old-house" });
    await renameProject(project.id, "new-house");

    expect(await resolve("/projects/old-house")).toEqual({ kind: "redirect", to: "/projects/new-house" });
    expect(await resolve("/projects/new-house")).toEqual({ kind: "project" });
  });

  it("creates no redirect for a draft", async () => {
    const project = await createProject({ slug: "draft-house", isPublished: false });
    await renameProject(project.id, "draft-house-2", { isPublished: false });

    expect(await prisma.redirect.count()).toBe(0);
    expect(await resolve("/projects/draft-house-2")).toEqual({ kind: "none" });
  });

  it("never forms chains, and a reused address stops redirecting", async () => {
    const project = await createProject({ slug: "a" });
    await renameProject(project.id, "b");
    await renameProject(project.id, "c");

    expect(await resolve("/projects/a")).toEqual({ kind: "redirect", to: "/projects/c" });
    expect(await resolve("/projects/b")).toEqual({ kind: "redirect", to: "/projects/c" });

    await renameProject(project.id, "a");
    expect(await resolve("/projects/a")).toEqual({ kind: "project" });
    expect(await resolve("/projects/c")).toEqual({ kind: "redirect", to: "/projects/a" });
    expect(await prisma.redirect.count({ where: { fromPath: "/projects/a" } })).toBe(0);
  });

  it("redirects a renamed custom page", async () => {
    const page = (await api(app, "post", "/api/admin/pages", cookie, pageInput())).body;
    await api(app, "put", `/api/admin/pages/${page.id}`, cookie, pageInput({ slug: "jobs" }));

    expect(await resolve("/careers")).toEqual({ kind: "redirect", to: "/jobs" });
    expect(await resolve("/jobs")).toEqual({ kind: "page" });
  });
});

describe("GET /api/public/resolve", () => {
  it("knows the built-in pages and ignores a trailing slash", async () => {
    for (const path of ["/", "/projects", "/services", "/about", "/contact", "/about/"]) {
      expect(await resolve(path)).toEqual({ kind: "page" });
    }
  });

  it("answers the same for a draft and for an address that never existed", async () => {
    await createProject({ slug: "secret", isPublished: false });
    await api(app, "post", "/api/admin/pages", cookie, pageInput({ slug: "hidden", isPublished: false }));

    expect(await resolve("/projects/secret")).toEqual({ kind: "none" });
    expect(await resolve("/hidden")).toEqual({ kind: "none" });
    expect(await resolve("/never-existed")).toEqual({ kind: "none" });
    expect(await resolve("/a/b/c")).toEqual({ kind: "none" });
  });

  it("rejects a path that isn't a site path", async () => {
    for (const path of ["https://evil.example.com", "//evil.example.com", "no-slash", "/" + "x".repeat(400)]) {
      expect((await request(app).get("/api/public/resolve").query({ path })).status).toBe(400);
    }
  });
});

describe("admin redirects", () => {
  it("adds, lists, searches and deletes manual redirects", async () => {
    const created = await api(app, "post", "/api/admin/redirects", cookie, { fromPath: "/old-blog", toPath: "/about" });
    expect(created.status).toBe(201);
    expect(await resolve("/old-blog")).toEqual({ kind: "redirect", to: "/about" });

    const dup = await api(app, "post", "/api/admin/redirects", cookie, { fromPath: "/old-blog", toPath: "/contact" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("REDIRECT_EXISTS");

    await api(app, "post", "/api/admin/redirects", cookie, { fromPath: "/team-2019", toPath: "/about" });
    const list = await api(app, "get", "/api/admin/redirects?q=blog", cookie);
    expect(list.body).toMatchObject({ total: 1, page: 1, items: [{ fromPath: "/old-blog", toPath: "/about" }] });

    expect((await api(app, "delete", `/api/admin/redirects/${created.body.id}`, cookie)).status).toBe(204);
    expect(await resolve("/old-blog")).toEqual({ kind: "none" });
  });

  it("refuses redirecting a live address, to itself, or off the site", async () => {
    await createProject({ slug: "live" });
    const cases = [
      { fromPath: "/projects/live", toPath: "/about" },
      { fromPath: "/about", toPath: "/contact" },
      { fromPath: "/x", toPath: "/x" },
      { fromPath: "/x", toPath: "https://evil.example.com" },
      { fromPath: "/x", toPath: "//evil.example.com" },
    ];
    for (const body of cases) {
      expect((await api(app, "post", "/api/admin/redirects", cookie, body)).status).toBe(400);
    }
  });
});

describe("GET /api/public/sitemap", () => {
  it("lists built-in pages, published pages and projects, without drafts or noindex records", async () => {
    await createProject({ slug: "shown" });
    await createProject({ slug: "draft", isPublished: false });
    await api(app, "post", "/api/admin/pages", cookie, pageInput({ slug: "careers" }));
    await api(app, "post", "/api/admin/pages", cookie, pageInput({ slug: "private", isPublished: false }));
    await prisma.project.update({ where: { slug: "shown" }, data: {} });
    const noindex = await createProject({ slug: "hidden-from-search" });
    await prisma.project.update({ where: { id: noindex.id }, data: { robotsIndex: false } });

    const res = await request(app).get("/api/public/sitemap");

    const paths = res.body.items.map((i: { path: string }) => i.path).sort();
    expect(paths).toEqual(["/", "/about", "/careers", "/contact", "/projects", "/projects/shown", "/services"]);
    const careers = res.body.items.find((i: { path: string }) => i.path === "/careers");
    expect(careers).toEqual({ path: "/careers", lastModified: expect.any(String), locales: ["ka"] });
    const shown = res.body.items.find((i: { path: string }) => i.path === "/projects/shown");
    expect(shown.locales).toEqual(["ka", "en"]);
  });
});

describe("access", () => {
  it("the admin redirect list needs a session", async () => {
    expect((await request(app).get("/api/admin/redirects")).status).toBe(401);
  });
});
