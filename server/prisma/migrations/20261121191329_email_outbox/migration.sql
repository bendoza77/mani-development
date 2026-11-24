-- CreateEnum
CREATE TYPE "email_status" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "email_messages" (
    "id" UUID NOT NULL,
    "recipient" VARCHAR(254) NOT NULL,
    "template" VARCHAR(40) NOT NULL,
    "locale" VARCHAR(2) NOT NULL DEFAULT 'ka',
    "payload" JSONB NOT NULL,
    "status" "email_status" NOT NULL DEFAULT 'pending',
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" VARCHAR(500),
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_messages_status_next_attempt_at_idx" ON "email_messages"("status", "next_attempt_at");
