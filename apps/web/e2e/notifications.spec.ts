import { expect, type Page, test } from '@playwright/test';

const STUDENT = {
  id: '0192d4a0-0000-7000-8000-000000000001',
  name: 'Demo Student',
  role: 'student',
};
const CLUB_NOTE = '0192d4a0-0000-7000-8000-0000000000a1';
const NEWS_NOTE = '0192d4a0-0000-7000-8000-0000000000a2';

const json = (status: number, body: unknown) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/** Stands in for the API (which has its own e2e tests for every rule). */
async function mockApi(page: Page) {
  const items = [
    {
      id: CLUB_NOTE,
      type: 'clubs.join_approved',
      title: 'You are now a member of Robotics Club (demo)',
      body: null,
      link: '/clubs/robotics-club-demo',
      read: false,
      createdAt: '2026-10-30T09:00:00.000Z',
    },
    {
      id: NEWS_NOTE,
      type: 'moderation.removed',
      title: 'Your news post was removed by a moderator',
      body: 'Reason: Advertising, not news',
      link: null,
      read: false,
      createdAt: '2026-10-29T09:00:00.000Z',
    },
  ];
  const calls: string[] = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const key = `${request.method()} ${path}`;

    if (key === 'GET /features') {
      return route.fulfill(json(200, { modules: ['auth', 'users', 'clubs', 'notifications'] }));
    }
    if (key === 'GET /auth/session') {
      return route.fulfill(json(200, { user: { ...STUDENT, roll: '1703999' } }));
    }
    if (key === 'GET /users/me') {
      return route.fulfill(
        json(200, {
          ...STUDENT,
          roll: '1703999',
          department: null,
          series: 2017,
          email: 'demo@example.com',
          phone: '+8801700000001',
          showEmail: false,
          showPhone: false,
          dismissedGuides: ['home', 'notifications', 'clubs'],
        }),
      );
    }
    if (key === 'GET /notifications') {
      return route.fulfill(json(200, { items, nextCursor: null }));
    }
    if (key === 'GET /notifications/unread-count') {
      return route.fulfill(json(200, { count: items.filter((n) => !n.read).length }));
    }
    const readOne = /^POST \/notifications\/([\w-]+)\/read$/.exec(key);
    if (readOne) {
      calls.push(key);
      const item = items.find((n) => n.id === readOne[1])!;
      item.read = true;
      return route.fulfill(json(200, item));
    }
    if (key === 'POST /notifications/read-all') {
      calls.push(key);
      for (const item of items) item.read = true;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill(json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
  });
  return calls;
}

test('a member reads their notifications from the bell', async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto('/');

  const bell = page.getByRole('link', { name: 'Notifications, 2 unread' });
  await expect(bell).toBeVisible();
  await bell.click();

  await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
  const list = page.getByRole('list', { name: 'Your notifications' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list).toContainText('Reason: Advertising, not news');

  // Without a link, the item has its own button.
  await list.getByRole('button', { name: 'Mark as read' }).click();
  await expect(page.getByRole('link', { name: 'Notifications, 1 unread' })).toBeVisible();

  // Opening one marks it read and goes to what it is about.
  await list.getByRole('link', { name: /Robotics Club \(demo\)/ }).click();
  await expect(page).toHaveURL(/\/clubs\/robotics-club-demo$/);
  expect(calls).toEqual([
    `POST /notifications/${NEWS_NOTE}/read`,
    `POST /notifications/${CLUB_NOTE}/read`,
  ]);
  await expect(page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible();
});

test('marking everything read clears the bell', async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto('/notifications');

  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
  expect(calls).toEqual(['POST /notifications/read-all']);
});
