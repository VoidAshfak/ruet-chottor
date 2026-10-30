-- CreateEnum
CREATE TYPE "LostFoundKind" AS ENUM ('lost', 'found');

-- CreateEnum
CREATE TYPE "LostFoundCategory" AS ENUM ('id_card', 'phone', 'keys', 'wallet', 'bag', 'book', 'electronics', 'clothing', 'other');

-- CreateEnum
CREATE TYPE "CampusPlace" AS ENUM ('central_library', 'academic_building', 'cafeteria', 'central_auditorium', 'residential_hall', 'medical_centre', 'playground', 'bus', 'main_gate', 'other');

-- CreateEnum
CREATE TYPE "LostFoundState" AS ENUM ('open', 'returned', 'closed');

-- CreateTable
CREATE TABLE "lost_found_items" (
    "id" UUID NOT NULL,
    "kind" "LostFoundKind" NOT NULL,
    "category" "LostFoundCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "place" "CampusPlace" NOT NULL,
    "placeDetail" TEXT,
    "happenedOn" DATE NOT NULL,
    "verifyQuestion" TEXT,
    "createdById" UUID NOT NULL,
    "state" "LostFoundState" NOT NULL DEFAULT 'open',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'visible',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lost_found_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lost_found_items_status_state_expiresAt_createdAt_idx" ON "lost_found_items"("status", "state", "expiresAt", "createdAt");

-- CreateIndex
CREATE INDEX "lost_found_items_createdById_createdAt_idx" ON "lost_found_items"("createdById", "createdAt");
