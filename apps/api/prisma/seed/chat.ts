// Sample conversations between the fake members from seed/users.ts, so Messages has something
// to show. Messages are only added when a conversation is created, so re-running changes nothing.
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { directKey } from '../../src/modules/chat/chat.service.js';

const MINUTE_MS = 60 * 1000;

export async function seedChat(prisma: PrismaClient) {
  const byRoll = async (roll: string) => prisma.user.findUniqueOrThrow({ where: { roll } });
  const student = await byRoll('1703999'); // Demo Student
  const rafiq = await byRoll('2103901');
  const sadia = await byRoll('2202904');
  const teacher = await byRoll('0000004');

  const start = Date.now() - 90 * MINUTE_MS;
  const at = (minutes: number) => new Date(start + minutes * MINUTE_MS);

  // 1:1 chat: Demo Student and Rafiq.
  const key = directKey(student.id, rafiq.id);
  if (!(await prisma.conversation.findUnique({ where: { directKey: key } }))) {
    const lines: [string, string][] = [
      [rafiq.id, 'Hi! Are you going to the robotics club meeting today? (demo message)'],
      [student.id, 'Yes, after the 3 PM class. See you at the gallery.'],
      [rafiq.id, 'Great, bring the sensor kit if you still have it.'],
    ];
    await prisma.conversation.create({
      data: {
        type: 'direct',
        createdById: rafiq.id,
        directKey: key,
        createdAt: at(0),
        lastMessageAt: at(lines.length),
        members: {
          create: [
            { userId: rafiq.id, joinedAt: at(0), lastReadAt: at(lines.length) },
            // The Demo Student has one unread message, so the badge is visible.
            { userId: student.id, joinedAt: at(0), lastReadAt: at(2) },
          ],
        },
        messages: {
          create: lines.map(([senderId, body], index) => ({
            senderId,
            body,
            createdAt: at(index + 1),
          })),
        },
      },
    });
  }

  // A group owned by the Demo Teacher.
  const groupName = 'Thesis group (demo)';
  const existingGroup = await prisma.conversation.findFirst({
    where: { type: 'group', name: groupName, createdById: teacher.id },
  });
  if (!existingGroup) {
    const lines: [string, string][] = [
      [teacher.id, 'Welcome! Please share your progress here every Thursday. (demo message)'],
      [sadia.id, 'Literature review is almost done.'],
      [student.id, 'I will send the dataset summary tonight.'],
    ];
    await prisma.conversation.create({
      data: {
        type: 'group',
        name: groupName,
        createdById: teacher.id,
        createdAt: at(10),
        lastMessageAt: at(10 + lines.length),
        members: {
          create: [
            { userId: teacher.id, role: 'owner', joinedAt: at(10), lastReadAt: at(20) },
            { userId: sadia.id, joinedAt: at(10), lastReadAt: at(20) },
            { userId: student.id, joinedAt: at(10), lastReadAt: at(20) },
          ],
        },
        messages: {
          create: lines.map(([senderId, body], index) => ({
            senderId,
            body,
            createdAt: at(11 + index),
          })),
        },
      },
    });
  }
}
