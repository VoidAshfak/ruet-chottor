// Sample events around the day the seed runs, so the calendar always shows something.
// Matched by title, so re-running adds nothing. Runs after seed/clubs.ts and the class rep seed
// (two class events by the demo CR: one approved, one waiting in Admin → Event review).
import type { EventCategory, PrismaClient } from '../../src/generated/prisma/client.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** `days` from today at `hour`:00 Dhaka time. */
function at(days: number, hour: number): Date {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
  const start = new Date(`${today}T${String(hour).padStart(2, '0')}:00:00+06:00`);
  return new Date(start.getTime() + days * DAY_MS);
}

export async function seedEvents(prisma: PrismaClient) {
  const byRoll = (roll: string) => prisma.user.findUniqueOrThrow({ where: { roll } });
  const manager = await byRoll('0000003'); // Demo Club Manager
  const admin = await byRoll('0000001');
  const student = await byRoll('1703999');
  const moderator = await byRoll('0000002');
  const classRep = await byRoll('2103901'); // Rafiq Fakeuddin, verified CR of CSE 2021 section A
  const forClass = { classDepartment: '03', classSeries: 2021, classSection: 'A' };
  const club = (name: string) => prisma.club.findUnique({ where: { name } });
  const robotics = await club('Robotics Club (demo)');
  const debating = await club('Debating Club (demo)');
  const blood = await club('Blood Donation Volunteers (demo)');

  const events: {
    title: string;
    category: EventCategory;
    venue: string;
    description: string;
    startsAt: Date;
    hours: number;
    clubId: string | null;
    createdById: string;
    capacity?: number;
    review?: 'pending' | 'approved';
    reviewedById?: string;
    reviewedAt?: Date;
    approvedAt?: Date;
    classDepartment?: string;
    classSeries?: number;
    classSection?: string;
  }[] = [
    {
      title: 'Line-follower workshop (demo)',
      category: 'workshop',
      venue: 'ECE building, room 301',
      description: 'Build a simple line-follower robot. Bring a laptop. (Sample event.)',
      startsAt: at(2, 16),
      hours: 2,
      clubId: robotics?.id ?? null,
      createdById: manager.id,
      capacity: 30,
    },
    {
      title: 'Debate practice round (demo)',
      category: 'meeting',
      venue: 'Central library seminar room',
      description: 'British Parliamentary practice. Beginners welcome. (Sample event.)',
      startsAt: at(5, 18),
      hours: 2,
      clubId: debating?.id ?? null,
      createdById: manager.id,
    },
    {
      title: 'Blood donation camp (demo)',
      category: 'other',
      venue: 'Medical centre',
      description: 'Donate blood or register as a donor. (Sample event that already happened.)',
      startsAt: at(-3, 10),
      hours: 5,
      clubId: blood?.id ?? null,
      createdById: manager.id,
    },
    {
      title: 'Freshers’ orientation (demo)',
      category: 'seminar',
      venue: 'Central auditorium',
      description: 'Welcome session for new students. (Sample campus-wide event.)',
      startsAt: at(10, 10),
      hours: 3,
      clubId: null,
      createdById: admin.id,
    },
    {
      title: 'CSE 2021 section A farewell planning (demo)',
      category: 'meeting',
      venue: 'ECE building, room 205',
      description: 'Venue, food and the slideshow for our farewell. (Sample class event.)',
      startsAt: at(4, 17),
      hours: 1,
      clubId: null,
      createdById: classRep.id,
      ...forClass,
      review: 'approved',
      reviewedById: moderator.id,
      reviewedAt: new Date(),
      approvedAt: new Date(),
    },
    {
      title: 'CSE 2021 section A Sajek tour sign-up (demo)',
      category: 'other',
      venue: 'Department common room',
      description:
        'Pay the advance and sign up for the class tour. (Sample class event waiting for review.)',
      startsAt: at(8, 14),
      hours: 2,
      clubId: null,
      createdById: classRep.id,
      ...forClass,
      review: 'pending',
    },
  ];

  for (const event of events) {
    if (await prisma.event.findFirst({ where: { title: event.title } })) continue;
    const { hours, ...data } = event;
    await prisma.event.create({
      data: { ...data, endsAt: new Date(data.startsAt.getTime() + hours * 60 * 60 * 1000) },
    });
  }

  // The Demo Student is going to the workshop.
  const workshop = await prisma.event.findFirst({ where: { title: events[0]!.title } });
  if (workshop) {
    await prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId: workshop.id, userId: student.id } },
      create: { eventId: workshop.id, userId: student.id },
      update: {},
    });
  }
}
