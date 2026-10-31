-- CreateEnum
CREATE TYPE "ClassRepStatus" AS ENUM ('pending', 'approved', 'rejected', 'withdrawn', 'revoked');

-- CreateEnum
CREATE TYPE "ClassSection" AS ENUM ('A', 'B', 'C', 'D', 'E');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ModerationAction" ADD VALUE 'verify_class_rep';
ALTER TYPE "ModerationAction" ADD VALUE 'reject_class_rep';
ALTER TYPE "ModerationAction" ADD VALUE 'revoke_class_rep';

-- CreateTable
CREATE TABLE "class_rep_requests" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "section" "ClassSection",
    "note" TEXT NOT NULL,
    "status" "ClassRepStatus" NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_rep_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_rep_requests_status_createdAt_idx" ON "class_rep_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "class_rep_requests_userId_createdAt_idx" ON "class_rep_requests"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "class_rep_requests" ADD CONSTRAINT "class_rep_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- At most one open request (pending or approved) per member. Prisma cannot express a partial
-- unique index, so it lives here; the service maps the violation to a friendly error.
CREATE UNIQUE INDEX "class_rep_requests_one_open_per_user" ON "class_rep_requests"("userId")
WHERE "status" IN ('pending', 'approved');
