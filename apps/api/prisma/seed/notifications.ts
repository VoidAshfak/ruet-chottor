// A few notifications for the Demo Student, so the bell has something to show. Links point at
// seeded clubs and news when they exist. Skipped if the student already has notifications.
import type { PrismaClient } from '../../src/generated/prisma/client.js';

const HOUR = 60 * 60 * 1000;

export async function seedNotifications(prisma: PrismaClient) {
  const student = await prisma.user.findUnique({ where: { roll: '1703999' } });
  if (!student) return;
  if ((await prisma.notification.count({ where: { userId: student.id } })) > 0) return;

  const club = await prisma.club.findUnique({ where: { name: 'Robotics Club (demo)' } });
  const post = await prisma.newsPost.findFirst({ where: { createdById: student.id } });
  const ago = (hours: number) => new Date(Date.now() - hours * HOUR);

  await prisma.notification.createMany({
    data: [
      {
        userId: student.id,
        type: 'clubs.join_approved',
        title: `You are now a member of ${club?.name ?? 'Robotics Club (demo)'}`,
        link: club ? `/clubs/${club.slug}` : null,
        createdAt: ago(2),
      },
      {
        userId: student.id,
        type: 'news.rejected',
        title: `Your post "${post?.title ?? 'Lost my calculator (demo)'}" was not published`,
        body: "Moderator's reason: Please post lost items in Lost & Found instead.",
        link: post ? `/news/${post.id}` : null,
        createdAt: ago(26),
      },
      {
        userId: student.id,
        type: 'events.changed',
        title: 'Line-follower workshop (demo) has changed',
        body: 'Now in the central auditorium.',
        createdAt: ago(50),
        readAt: ago(49),
      },
    ],
  });
}
