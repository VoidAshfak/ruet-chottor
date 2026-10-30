-- CreateEnum
CREATE TYPE "ClubCategory" AS ENUM ('technical', 'cultural', 'sports', 'social_service', 'academic', 'other');

-- CreateEnum
CREATE TYPE "ClubRole" AS ENUM ('manager', 'member');

-- CreateEnum
CREATE TYPE "MembershipState" AS ENUM ('pending', 'active');

-- AlterTable
ALTER TABLE "news_posts" ADD COLUMN     "clubId" UUID;

-- CreateTable
CREATE TABLE "clubs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "category" "ClubCategory" NOT NULL,
    "about" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT,
    "links" JSONB NOT NULL DEFAULT '[]',
    "createdById" UUID NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'visible',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_memberships" (
    "clubId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ClubRole" NOT NULL DEFAULT 'member',
    "state" "MembershipState" NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),

    CONSTRAINT "club_memberships_pkey" PRIMARY KEY ("clubId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "clubs_name_key" ON "clubs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "clubs_slug_key" ON "clubs"("slug");

-- CreateIndex
CREATE INDEX "clubs_status_name_idx" ON "clubs"("status", "name");

-- CreateIndex
CREATE INDEX "club_memberships_userId_idx" ON "club_memberships"("userId");

-- CreateIndex
CREATE INDEX "club_memberships_clubId_state_idx" ON "club_memberships"("clubId", "state");

-- CreateIndex
CREATE INDEX "news_posts_clubId_publishedAt_idx" ON "news_posts"("clubId", "publishedAt");

-- AddForeignKey
ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
