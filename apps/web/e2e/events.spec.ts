import { expect, type Page, test } from '@playwright/test';

const STUDENT = {
  id: '0192d4a0-0000-7000-8000-000000000001',
  name: 'Demo Student',
  role: 'student',
};
const MANAGER = {
  id: '0192d4a0-0000-7000-8000-000000000003',
  name: 'Demo Club Manager',
  role: 'club_manager',
};
const CLUB = {
  id: '0192d4a0-0000-7000-8000-0000000000b1',
  slug: 'robotics-club-demo',
  name: 'Robotics Club (demo)',
};
const EVENT_ID = '0192d4a0-0000-7000-8000-0000000000d1';

/** Today in Dhaka as "YYYY-MM-DD", like the calendar works it out. */
const todayInDhaka = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const json = (status: number, body: unknown) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/** Stands in for the API (which has its own e2e tests for every rule). */
async function mockApi(page: Page, viewer: typeof STUDENT) {
  const today = todayInDhaka();
  // 11 PM Dhaka time today, for two hours: still "today" on the calendar, and not over yet.
  const event = {
    id: EVENT_ID,
    title: 'Line-follower workshop',
    category: 'workshop',
    description: 'Bring a laptop.',
    venue: 'ECE building, room 301',
    startsAt: new Date(`${today}T23:00:00+06:00`).toISOString(),
    endsAt: new Date(`${today}T23:59:00+06:00`).toISOString(),
    club: CLUB,
    organiser: MANAGER,
    poster: null,
    capacity: 30,
    goingCount: 12,
    isGoing: false,
    isFull: false,
    cancelled: false,
    moderated: false,
    canEdit: viewer.id === MANAGER.id,
    canEditDetails: viewer.id === MANAGER.id,
  };
  const created: unknown[] = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const key = `${request.method()} ${path}`;

    if (key === 'GET /features') {
      return route.fulfill(json(200, { modules: ['auth', 'users', 'clubs', 'events', 'admin'] }));
    }
    if (key === 'GET /auth/session') {
      return route.fulfill(json(200, { user: { ...viewer, roll: '1703999' } }));
    }
    if (key === 'GET /users/me') {
      return route.fulfill(
        json(200, {
          ...viewer,
          roll: '1703999',
          department: null,
          series: 2017,
          email: 'demo@example.com',
          phone: '+8801700000001',
          showEmail: false,
          showPhone: false,
          dismissedGuides: ['events'],
        }),
      );
    }
    if (key === 'GET /clubs/mine') {
      const mine =
        viewer.id === MANAGER.id
          ? [
              {
                ...CLUB,
                tagline: 'Robots',
                category: 'technical',
                logo: null,
                memberCount: 1,
                myMembership: { role: 'manager', state: 'active' },
                moderated: false,
              },
            ]
          : [];
      return route.fulfill(json(200, mine));
    }
    if (key === 'GET /events') return route.fulfill(json(200, { items: [event] }));
    if (key === `GET /events/${EVENT_ID}`) return route.fulfill(json(200, event));
    if (key === `POST /events/${EVENT_ID}/rsvp`) {
      Object.assign(event, { isGoing: true, goingCount: event.goingCount + 1 });
      return route.fulfill(json(200, event));
    }
    if (key === 'POST /events') {
      const body = request.postDataJSON() as Record<string, unknown>;
      created.push(body);
      return route.fulfill(json(201, { ...event, ...body, id: EVENT_ID, club: CLUB }));
    }
    return route.fulfill(json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
  });
  return created;
}

test('a student finds today’s event on the calendar and says they are going', async ({ page }) => {
  await mockApi(page, STUDENT);
  await page.goto('/events');

  // Today is selected; its event is listed under the calendar.
  await expect(page.getByRole('button', { name: /, 1 event$/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('link', { name: /Line-follower workshop/ }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Line-follower workshop' }),
  ).toBeVisible();
  await expect(page.getByText('12 of 30 places taken')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Robotics Club (demo)' })).toBeVisible();
  await page.getByRole('button', { name: 'I’m going' }).click();
  await expect(page.getByText('You’re going')).toBeVisible();
  await expect(page.getByText('13 of 30 places taken')).toBeVisible();
});

test('a club manager creates an event in Dhaka time', async ({ page }) => {
  const created = await mockApi(page, MANAGER);
  await page.goto('/events');
  await page.getByRole('link', { name: 'Create event' }).click();

  await page.getByRole('textbox', { name: 'Title' }).fill('Sumo-bot contest');
  await page.getByRole('combobox', { name: 'Category' }).selectOption('competition');
  await expect(page.getByRole('combobox', { name: 'Organised by' })).toHaveValue(CLUB.id);
  await page.getByLabel('Starts').fill('2030-11-02T15:00');
  await page.getByLabel('Ends').fill('2030-11-02T17:30');
  await page.getByRole('textbox', { name: 'Where' }).fill('Central auditorium');
  await page.getByRole('button', { name: 'Create event' }).click();

  await expect(page).toHaveURL(new RegExp(`/events/${EVENT_ID}$`));
  expect(created[0]).toMatchObject({
    title: 'Sumo-bot contest',
    clubId: CLUB.id,
    // 3 PM in Rajshahi is 9 AM UTC.
    startsAt: '2030-11-02T09:00:00.000Z',
    endsAt: '2030-11-02T11:30:00.000Z',
  });
});
