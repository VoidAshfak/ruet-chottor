-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('announcement', 'academic', 'event', 'club', 'general');

-- CreateEnum
CREATE TYPE "NewsReview" AS ENUM ('pending', 'approved', 'rejected');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ModerationAction" ADD VALUE 'approve_content';
ALTER TYPE "ModerationAction" ADD VALUE 'reject_content';

-- CreateTable
CREATE TABLE "news_posts" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" "NewsCategory" NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "review" "NewsReview" NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "status" "ContentStatus" NOT NULL DEFAULT 'visible',
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "news_posts_review_status_publishedAt_idx" ON "news_posts"("review", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "news_posts_createdById_createdAt_idx" ON "news_posts"("createdById", "createdAt");
