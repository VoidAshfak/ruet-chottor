// Sample moderation history for the fake members created by seed/users.ts, so the admin panel and
// moderation log have something to show. The log is append-only, so entries are only added once.
import type { ModerationAction, PrismaClient } from '../../src/generated/prisma/client.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function seedAdmin(prisma: PrismaClient) {
  const byRoll = async (roll: string) => prisma.user.findUniqueOrThrow({ where: { roll } });
  const moderator = await byRoll('0000002');
  const suspended = await byRoll('2103908');
  const warned = await byRoll('2200903');

  const once = async (
    targetUserId: string,
    action: ModerationAction,
    reason: string,
    details?: Record<string, string | number>,
  ) => {
    const exists = await prisma.moderationLog.findFirst({ where: { targetUserId, action } });
    if (!exists) {
      await prisma.moderationLog.create({
        data: { moderatorId: moderator.id, targetUserId, action, reason, details },
      });
    }
  };

  await once(
    warned.id,
    'warn_user',
    'Sample warning: off-topic advertising in a group (demo data).',
  );
  await once(suspended.id, 'warn_user', 'Sample warning: repeated spam links (demo data).');

  const until = new Date(Date.now() + 7 * DAY_MS);
  await once(suspended.id, 'suspend_user', 'Sample suspension after a warning (demo data).', {
    days: 7,
    until: until.toISOString(),
  });
  // Keep the demo suspension running a week from each seed run.
  await prisma.user.update({
    where: { id: suspended.id },
    data: { status: 'suspended', suspendedUntil: until },
  });
}
