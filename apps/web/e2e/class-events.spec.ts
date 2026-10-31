import { expect, type Page, test } from '@playwright/test';

const CR = {
  id: '0192d4a0-0000-7000-8000-0000000000e1',
  name: 'Demo CR',
  roll: '2103045',
  role: 'student',
};
const MODERATOR = {
  id: '0192d4a0-0000-7000-8000-0000000000e2',
  name: 'Demo Moderator',
  roll: '0000002',
  role: 'moderator',
};
const EVENT_ID = '0192d4a0-0000-7000-8000-0000000000e9';
const CLASS = {
  department: { code: '03', short: 'CSE', name: 'Computer Science & Engineering' },
  series: 2021,
  section: 'A',
};

const json = (status: number, body: unknown) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/** Stands in for the API (the API has its own e2e tests for every rule). */
async function mockApi(page: Page, viewer: typeof CR) {
  const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const event = {
    id: EVENT_ID,
    title: 'CSE 21 farewell planning',
    category: 'meeting',
    description: 'Venue, food and the slideshow.',
    venue: 'ECE building, room 301',
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    club: null,
    class: CLASS,
    organiser: { id: CR.id, name: CR.name, role: CR.role },
    poster: null,
    capacity: null,
    goingCount: 0,
    isGoing: false,
    isFull: false,
    cancelled: false,
    moderated: false,
    canEdit: true,
    canEditDetails: viewer.id === CR.id,
    review: 'pending',
    reviewNote: null,
  };
  const calls: { method: string; path: string; body: unknown }[] = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const body: unknown = request.postDataJSON();
    calls.push({ method: request.method(), path, body });
    switch (`${request.method()} ${path}`) {
      case 'GET /features':
        return route.fulfill(json(200, { modules: ['auth', 'users', 'events', 'admin'] }));
      case 'GET /auth/session':
        return route.fulfill(json(200, { user: viewer }));
      case 'GET /users/me':
        return route.fulfill(
          json(200, {
            ...viewer,
            department: CLASS.department,
            series: 2021,
            email: 'demo@example.com',
            phone: '+8801700000001',
            showEmail: false,
            showPhone: false,
            classRep:
              viewer.id === CR.id ? { section: 'A', since: new Date().toISOString() } : null,
            dismissedGuides: ['events', 'admin'],
          }),
        );
      case 'GET /clubs/mine':
        return route.fulfill(json(200, []));
      case 'POST /events':
        return route.fulfill(json(201, { ...event, ...(body as object), class: CLASS }));
      case `GET /events/${EVENT_ID}`:
        return route.fulfill(json(200, event));
      case 'GET /events/review':
        return route.fulfill(json(200, { items: [event], nextCursor: null }));
      case `POST /events/${EVENT_ID}/approve`:
        return route.fulfill(json(200, { ...event, review: 'approved' }));
      default:
        return route.fulfill(json(200, { items: [] }));
    }
  });
  return calls;
}

test('a class representative proposes a class event, which waits for review', async ({ page }) => {
  const calls = await mockApi(page, CR);
  await page.goto('/events/new');

  await expect(page.getByLabel('Organised by', { exact: true })).toHaveValue('class');
  await expect(page.getByText(/not tests or assignments/)).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('CSE 21 farewell planning');
  await page.getByLabel('Category', { exact: true }).selectOption('meeting');
  await page.getByLabel('Starts', { exact: true }).fill('2030-01-10T15:00');
  await page.getByLabel('Ends', { exact: true }).fill('2030-01-10T17:00');
  await page.getByLabel('Where', { exact: true }).fill('ECE building, room 301');
  await page.getByRole('button', { name: 'Create event' }).click();

  await expect(page.getByText(/Waiting for a moderator to approve it/)).toBeVisible();
  await expect(page.getByText('CSE 2021 · Section A', { exact: true })).toBeVisible();
  const created = calls.find((c) => c.method === 'POST' && c.path === '/events');
  expect(created?.body).toMatchObject({ forClass: true, clubId: null });
});

test('a moderator approves a waiting class event', async ({ page }) => {
  const calls = await mockApi(page, MODERATOR);
  await page.goto('/admin/events');

  await expect(page.getByRole('heading', { level: 1, name: 'Event review' })).toBeVisible();
  await expect(page.getByText(/CSE 2021 · Section A · Proposed by Demo CR/)).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect.poll(() => calls.some((c) => c.path.endsWith('/approve'))).toBe(true);
});
