import { expect, type Page, test } from '@playwright/test';

const STUDENT = {
  id: '0192d4a0-0000-7000-8000-000000000001',
  name: 'Demo Student',
  role: 'student',
};
const ADMIN = { id: '0192d4a0-0000-7000-8000-000000000009', name: 'Demo Admin', role: 'admin' };
const ROUTE_ID = '0192d4a0-0000-7000-8000-0000000000e1';
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const json = (status: number, body: unknown) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

// Late enough that it is still ahead whenever the test runs (unless it runs after 23:55 Dhaka).
const route = {
  id: ROUTE_ID,
  name: 'Route A (demo)',
  description: 'Campus to the railway station.',
  color: 'teal',
  active: true,
  stops: [
    { id: 's1', name: 'Campus', minutesFromCampus: 0 },
    { id: 's2', name: 'Talaimari', minutesFromCampus: 5 },
    { id: 's3', name: 'Railway station', minutesFromCampus: 25 },
  ],
  trips: [
    { id: 't1', direction: 'from_campus', departsAt: '23:50', days: EVERY_DAY, note: 'Night trip' },
    { id: 't2', direction: 'to_campus', departsAt: '07:30', days: [0, 1, 2, 3, 4, 6], note: null },
  ],
  updatedAt: '2026-10-30T00:00:00.000Z',
};

/** Stands in for the API (which has its own e2e tests for every rule). */
async function mockApi(page: Page, viewer: typeof STUDENT) {
  const saved: Record<string, unknown>[] = [];
  await page.route('**/api/v1/**', async (route_) => {
    const request = route_.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const key = `${request.method()} ${path}`;

    if (key === 'GET /features') {
      return route_.fulfill(json(200, { modules: ['auth', 'users', 'bus', 'admin'] }));
    }
    if (key === 'GET /auth/session') {
      return route_.fulfill(json(200, { user: { ...viewer, roll: '1703999' } }));
    }
    if (key === 'GET /users/me') {
      return route_.fulfill(
        json(200, {
          ...viewer,
          roll: '1703999',
          department: null,
          series: 2017,
          email: 'demo@example.com',
          phone: '+8801700000001',
          showEmail: false,
          showPhone: false,
          dismissedGuides: ['bus', 'admin'],
        }),
      );
    }
    if (key === 'GET /bus/routes') return route_.fulfill(json(200, { items: [route] }));
    if (key === `GET /bus/routes/${ROUTE_ID}`) return route_.fulfill(json(200, route));
    if (key === 'GET /bus/notices') {
      return route_.fulfill(
        json(200, {
          items: [
            {
              id: 'n1',
              route: { id: ROUTE_ID, name: route.name, color: route.color },
              message: 'Diverted via Laxmipur this week.',
              startsOn: '2026-10-28',
              endsOn: '2030-11-02',
            },
          ],
        }),
      );
    }
    if (key === 'POST /bus/routes') {
      saved.push(request.postDataJSON() as Record<string, unknown>);
      return route_.fulfill(json(201, route));
    }
    return route_.fulfill(json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
  });
  return saved;
}

test('a student checks the next bus from their stop', async ({ page }) => {
  await mockApi(page, STUDENT);
  await page.goto('/bus');

  await expect(page.getByText('Diverted via Laxmipur this week.')).toBeVisible();
  await page.getByRole('combobox', { name: 'Your stop' }).selectOption('Talaimari');
  const next = page.getByRole('listitem').filter({ hasText: '11:55 PM' });
  await expect(next).toContainText(/in \d+/);
  await expect(next).toContainText('From campus');
  await expect(next).toContainText('Night trip');

  await page.getByRole('link', { name: /Route A \(demo\)/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Route A (demo)' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Sat–Thu' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '7:30 AM' })).toBeVisible();
});

test('an admin builds a route with stops and a trip', async ({ page }) => {
  const saved = await mockApi(page, ADMIN);
  await page.goto('/admin/bus/new');

  await page.getByRole('textbox', { name: 'Route name' }).fill('Route B (demo)');
  await page.getByRole('combobox', { name: 'Colour' }).selectOption('orange');
  await page.getByRole('textbox', { name: 'Stop 2' }).fill('Shaheb Bazar');
  await page.getByRole('spinbutton', { name: 'Minutes from campus 2' }).fill('20');
  await page.getByRole('button', { name: 'Add a trip' }).click();
  await page.getByLabel('Leaves at').fill('16:30');
  await page.getByRole('button', { name: 'Save route' }).click();

  await expect(page).toHaveURL(/\/admin\/bus$/);
  expect(saved[0]).toMatchObject({
    name: 'Route B (demo)',
    color: 'orange',
    stops: [
      { name: 'Campus', minutesFromCampus: 0 },
      { name: 'Shaheb Bazar', minutesFromCampus: 20 },
    ],
    trips: [{ direction: 'from_campus', departsAt: '16:30', days: [6, 0, 1, 2, 3, 4] }],
  });
});
