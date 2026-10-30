// PLACEHOLDER bus routes so the page has something to show. These are NOT the real RUET timetable:
// stop names are well-known Rajshahi places, but routes and times are made up. Admins enter the
// official timetable in Admin -> Bus (docs/modules/bus.md). Matched by name, so re-running adds nothing.
import type { BusColor, BusDirection, PrismaClient } from '../../src/generated/prisma/client.js';

const WORKING_DAYS = [0, 1, 2, 3, 4, 6]; // Saturday to Thursday
const FRIDAY = [5];

type SampleRoute = {
  name: string;
  description: string;
  color: BusColor;
  stops: [string, number][];
  trips: [BusDirection, string, number[], string | null][];
};

const ROUTES: SampleRoute[] = [
  {
    name: 'Route A (demo)',
    description: 'Placeholder route: campus to the railway station. Not the real timetable.',
    color: 'blue',
    stops: [
      ['Campus', 0],
      ['Talaimari', 8],
      ['Shaheb Bazar', 20],
      ['Railway station', 30],
    ],
    trips: [
      ['to_campus', '07:30', WORKING_DAYS, null],
      ['to_campus', '08:30', WORKING_DAYS, null],
      ['from_campus', '13:30', WORKING_DAYS, null],
      ['from_campus', '17:15', WORKING_DAYS, null],
      ['from_campus', '15:00', FRIDAY, 'Friday only'],
    ],
  },
  {
    name: 'Route B (demo)',
    description: 'Placeholder route: campus to Laxmipur. Not the real timetable.',
    color: 'green',
    stops: [
      ['Campus', 0],
      ['Kazla', 6],
      ['Laxmipur', 18],
    ],
    trips: [
      ['to_campus', '07:45', WORKING_DAYS, null],
      ['from_campus', '16:30', WORKING_DAYS, null],
    ],
  },
];

const clock = (time: string) => {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

export async function seedBus(prisma: PrismaClient) {
  for (const route of ROUTES) {
    if (await prisma.busRoute.findUnique({ where: { name: route.name } })) continue;
    await prisma.busRoute.create({
      data: {
        name: route.name,
        description: route.description,
        color: route.color,
        stops: {
          create: route.stops.map(([name, minutesFromCampus], position) => ({
            name,
            position,
            minutesFromCampus,
          })),
        },
        trips: {
          create: route.trips.map(([direction, time, days, note]) => ({
            direction,
            departMinutes: clock(time),
            days,
            note,
          })),
        },
      },
    });
  }
}
