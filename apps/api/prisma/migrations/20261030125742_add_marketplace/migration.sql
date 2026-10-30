-- CreateEnum
CREATE TYPE "ListingCategory" AS ENUM ('books', 'electronics', 'lab_equipment', 'furniture', 'clothing', 'bicycles', 'tickets', 'other');

-- CreateEnum
CREATE TYPE "ListingCondition" AS ENUM ('new', 'like_new', 'good', 'fair');

-- CreateEnum
CREATE TYPE "ListingState" AS ENUM ('available', 'reserved', 'sold');

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" "ListingCategory" NOT NULL,
    "condition" "ListingCondition" NOT NULL,
    "priceTaka" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "meetPlace" "CampusPlace" NOT NULL,
    "meetDetail" TEXT,
    "createdById" UUID NOT NULL,
    "state" "ListingState" NOT NULL DEFAULT 'available',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'visible',
    "heldTerm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listings_status_state_expiresAt_createdAt_idx" ON "listings"("status", "state", "expiresAt", "createdAt");

-- CreateIndex
CREATE INDEX "listings_status_state_expiresAt_priceTaka_idx" ON "listings"("status", "state", "expiresAt", "priceTaka");

-- CreateIndex
CREATE INDEX "listings_createdById_createdAt_idx" ON "listings"("createdById", "createdAt");
