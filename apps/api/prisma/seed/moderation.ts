// A sample reported message, so the staff queue (Admin → Reports) has something to review.
// Runs after seed/chat.ts; adds nothing if the message already exists.
import type { PrismaClient } from '../../src/generated/prisma/client.js';

const SPAM = 'Selling exam answers, message me for prices! (demo spam)';

export async function seedModeration(prisma: PrismaClient) {
  const byRoll = async (roll: string) => prisma.user.findUniqueOrThrow({ where: { roll } });
  const student = await byRoll('1703999'); // Demo Student
  const sadia = await byRoll('2202904');
  const teacher = await byRoll('0000004');

  const group = await prisma.conversation.findFirst({
    where: { type: 'group', name: 'Thesis group (demo)', createdById: teacher.id },
  });
  if (!group) return;
  if (await prisma.message.findFirst({ where: { conversationId: group.id, body: SPAM } })) return;

  const now = new Date();
  const message = await prisma.message.create({
    data: { conversationId: group.id, senderId: sadia.id, body: SPAM, createdAt: now },
  });
  await prisma.conversation.update({ where: { id: group.id }, data: { lastMessageAt: now } });
  await prisma.report.create({
    data: {
      contentType: 'chat.message',
      contentId: message.id,
      reporterId: student.id,
      reason: 'scam',
      note: 'Posted in our thesis group (demo report).',
    },
  });
}
