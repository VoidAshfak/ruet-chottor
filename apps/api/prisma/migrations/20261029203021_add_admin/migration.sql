-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('warn_user', 'suspend_user', 'ban_user', 'reinstate_user', 'change_role');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "suspendedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "moderation_logs" (
    "id" UUID NOT NULL,
    "moderatorId" UUID NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "targetUserId" UUID,
    "contentType" TEXT,
    "contentId" TEXT,
    "reason" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moderation_logs_targetUserId_createdAt_idx" ON "moderation_logs"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "moderation_logs_createdAt_idx" ON "moderation_logs"("createdAt");

-- The moderation log is append-only (CLAUDE.md §7): refuse any change to existing rows.
CREATE FUNCTION moderation_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'moderation_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER moderation_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON "moderation_logs"
  FOR EACH ROW EXECUTE FUNCTION moderation_logs_append_only();
