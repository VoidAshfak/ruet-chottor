-- CreateEnum
CREATE TYPE "EventReview" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "classDepartment" TEXT,
ADD COLUMN     "classSection" TEXT,
ADD COLUMN     "classSeries" INTEGER,
ADD COLUMN     "review" "EventReview" NOT NULL DEFAULT 'approved',
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" UUID;

-- CreateIndex
CREATE INDEX "events_review_createdAt_idx" ON "events"("review", "createdAt");

