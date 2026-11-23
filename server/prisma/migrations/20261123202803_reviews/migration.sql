-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('pending', 'approved', 'rejected');

-- AlterEnum
ALTER TYPE "activity_kind" ADD VALUE 'review';

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "text" VARCHAR(1000) NOT NULL,
    "rating" SMALLINT NOT NULL,
    "locale" VARCHAR(2) NOT NULL DEFAULT 'ka',
    "status" "review_status" NOT NULL DEFAULT 'pending',
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_status_created_at_idx" ON "reviews"("status", "created_at" DESC);

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
