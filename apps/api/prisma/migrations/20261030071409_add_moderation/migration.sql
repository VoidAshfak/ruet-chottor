-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('spam', 'harassment', 'violence', 'misinformation', 'inappropriate', 'scam', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'actioned', 'dismissed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ModerationAction" ADD VALUE 'hide_content';
ALTER TYPE "ModerationAction" ADD VALUE 'remove_content';
ALTER TYPE "ModerationAction" ADD VALUE 'restore_content';
ALTER TYPE "ModerationAction" ADD VALUE 'dismiss_reports';

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "note" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_status_contentType_idx" ON "reports"("status", "contentType");

-- CreateIndex
CREATE UNIQUE INDEX "reports_contentType_contentId_reporterId_key" ON "reports"("contentType", "contentId", "reporterId");
