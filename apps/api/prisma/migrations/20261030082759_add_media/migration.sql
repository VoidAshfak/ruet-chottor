-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('image', 'video', 'document');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('pending', 'ready');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "purpose" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'pending',
    "format" TEXT,
    "bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "contentId" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attachedAt" TIMESTAMP(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_publicId_key" ON "media_assets"("publicId");

-- CreateIndex
CREATE INDEX "media_assets_ownerId_status_idx" ON "media_assets"("ownerId", "status");

-- CreateIndex
CREATE INDEX "media_assets_purpose_contentId_idx" ON "media_assets"("purpose", "contentId");
