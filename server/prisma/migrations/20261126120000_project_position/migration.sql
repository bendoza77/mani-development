-- AlterTable
ALTER TABLE "projects" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "projects_position_idx" ON "projects"("position");

-- Number existing projects in the order the website showed them: private houses first, then newest.
UPDATE "projects" p SET "position" = o.n
FROM (
  SELECT "id", ROW_NUMBER() OVER (
    ORDER BY ("category" <> 'residential'), COALESCE("completion_date", "estimated_completion") DESC, "updated_at" DESC
  ) - 1 AS n
  FROM "projects"
) o
WHERE p."id" = o."id";
