// Sample news for the feed and the review queue. Text only: seeded posts have no Cloudinary files.
// Posts are matched by title, so re-running adds nothing.
import type { NewsCategory, NewsReview, PrismaClient } from '../../src/generated/prisma/client.js';

const HOUR_MS = 60 * 60 * 1000;

type SamplePost = {
  roll: string;
  title: string;
  category: NewsCategory;
  body: string;
  review: NewsReview;
  reviewNote?: string;
  hoursAgo: number;
};

const POSTS: SamplePost[] = [
  {
    roll: '0000001', // Demo Admin
    title: 'Welcome to RUET Chottor news (demo)',
    category: 'announcement',
    body: 'This is sample news for development. Verified accounts publish straight away; posts from other members are checked by a moderator first.',
    review: 'approved',
    hoursAgo: 48,
  },
  {
    roll: '0000003', // Demo Club Manager
    title: 'Robotics club: line-follower workshop on Thursday (demo)',
    category: 'club',
    body: 'Bring a laptop. We meet at 4 PM in the club room and will build a simple line-follower together. Beginners welcome. (Sample post.)',
    review: 'approved',
    hoursAgo: 20,
  },
  {
    roll: '0000004', // Demo Teacher, reviewed by a moderator
    title: 'Term-final routine draft is out (demo)',
    category: 'academic',
    body: 'A draft routine has been shared with class representatives. Check with yours and report clashes before Sunday. (Sample post; no real routine.)',
    review: 'approved',
    hoursAgo: 6,
  },
  {
    roll: '1703999', // Demo Student: waiting in the review queue
    title: 'Lost a blue umbrella near the central library (demo)',
    category: 'general',
    body: 'If you found a blue umbrella near the central library yesterday evening, please message me. (Sample post waiting for review.)',
    review: 'pending',
    hoursAgo: 2,
  },
  {
    roll: '1703999', // Demo Student: rejected, so "My posts" shows a moderator note
    title: 'Selling notes cheap (demo)',
    category: 'general',
    body: 'Message me for notes of every course at a low price. (Sample post that a moderator did not publish.)',
    review: 'rejected',
    reviewNote: 'Buying and selling belongs in the marketplace, not news.',
    hoursAgo: 30,
  },
];

export async function seedNews(prisma: PrismaClient) {
  const moderator = await prisma.user.findUniqueOrThrow({ where: { roll: '0000002' } });
  for (const post of POSTS) {
    if (await prisma.newsPost.findFirst({ where: { title: post.title } })) continue;
    const author = await prisma.user.findUniqueOrThrow({ where: { roll: post.roll } });
    const at = new Date(Date.now() - post.hoursAgo * HOUR_MS);
    const reviewed =
      post.review !== 'pending' && author.role !== 'admin' && author.role !== 'club_manager';
    await prisma.newsPost.create({
      data: {
        title: post.title,
        category: post.category,
        body: post.body,
        createdById: author.id,
        review: post.review,
        reviewNote: post.reviewNote ?? null,
        reviewedById: reviewed ? moderator.id : null,
        reviewedAt: reviewed ? at : null,
        publishedAt: post.review === 'approved' ? at : null,
        createdAt: at,
      },
    });
  }
}
