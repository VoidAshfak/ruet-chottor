import { expect, type Page, test } from '@playwright/test';

const student = {
  id: '0192d4a0-0000-7000-8000-0000000000c1',
  name: 'Test Student',
  roll: '2103045',
  role: 'student',
  department: { code: '03', short: 'CSE', name: 'Computer Science & Engineering' },
  series: 2021,
  email: 'test.student@example.com',
  phone: '+8801700000001',
  showEmail: false,
  showPhone: false,
  classRep: null,
  dismissedGuides: ['users', 'admin'],
};
const moderator = {
  ...student,
  id: '0192d4a0-0000-7000-8000-0000000000c2',
  name: 'Test Moderator',
  role: 'moderator',
};
const NOTE = 'Chosen by our class in the first week; our class adviser can confirm.';

type Request = {
  id: string;
  status: string;
  section: string | null;
  note: string;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

/** Stands in for the API (the API has its own e2e tests for the rules). */
async function mockApi(page: Page, me: typeof student) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  let request: Request | null = null;
  const waiting: Request = {
    id: '0192d4a0-0000-7000-8000-0000000000r1',
    status: 'pending',
    section: 'B',
    note: NOTE,
    reviewNote: null,
    createdAt: '2026-10-30T04:00:00.000Z',
    reviewedAt: null,
  };
  const json = (status: number, body: unknown) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace('/api/v1', '');
    const body: unknown = req.postDataJSON();
    calls.push({ method: req.method(), path, body });
    switch (`${req.method()} ${path}`) {
      case 'GET /features':
        return route.fulfill(json(200, { modules: ['auth', 'users', 'admin'] }));
      case 'GET /auth/session':
        return route.fulfill(
          json(200, { user: { id: me.id, name: me.name, roll: me.roll, role: me.role } }),
        );
      case 'GET /users/me':
        return route.fulfill(json(200, me));
      case 'GET /users/me/class-rep':
        return route.fulfill(json(200, { request }));
      case 'POST /users/me/class-rep':
        request = {
          id: '0192d4a0-0000-7000-8000-0000000000r2',
          status: 'pending',
          ...(body as { section: string | null; note: string }),
          reviewNote: null,
          createdAt: new Date().toISOString(),
          reviewedAt: null,
        };
        return route.fulfill(json(201, { request }));
      case 'GET /users/class-reps':
        return route.fulfill(
          json(200, {
            items:
              url.searchParams.get('status') === 'pending'
                ? [
                    {
                      ...waiting,
                      user: {
                        id: student.id,
                        name: student.name,
                        roll: student.roll,
                        department: student.department,
                        series: student.series,
                      },
                    },
                  ]
                : [],
            nextCursor: null,
          }),
        );
      case `POST /users/class-reps/${waiting.id}/approve`:
        return route.fulfill(
          json(200, { ...waiting, status: 'approved', reviewedAt: new Date().toISOString() }),
        );
      default:
        return route.fulfill(json(200, { items: [], nextCursor: null }));
    }
  });
  return calls;
}

test('a student asks to be verified as CR and sees it waiting', async ({ page }) => {
  const calls = await mockApi(page, student);
  await page.goto('/profile');

  const card = page.getByRole('region', { name: 'Class representative' });
  await expect(card.getByText('For your class: CSE 2021')).toBeVisible();
  await card.getByLabel('Section', { exact: true }).selectOption('B');
  await card.getByRole('button', { name: 'Ask to be verified' }).click();
  // Too short a note is caught before anything is sent.
  await expect(card.getByText(/Write at least 10 characters/)).toBeVisible();

  await card.getByLabel('How can a moderator check this?', { exact: true }).fill(NOTE);
  await card.getByRole('button', { name: 'Ask to be verified' }).click();
  await expect(card.getByText(/A moderator will check it soon/)).toBeVisible();
  expect(calls).toContainEqual({
    method: 'POST',
    path: '/users/me/class-rep',
    body: { section: 'B', note: NOTE },
  });
});

test('a moderator verifies a waiting request', async ({ page }) => {
  const calls = await mockApi(page, moderator);
  await page.goto('/admin/class-reps');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Class representatives' }),
  ).toBeVisible();
  await expect(page.getByText(NOTE)).toBeVisible();
  await expect(page.getByText(/CSE 2021, section B/)).toBeVisible();
  await page.getByRole('button', { name: 'Verify as CR', exact: true }).click();
  await expect.poll(() => calls.some((c) => c.path.endsWith('/approve'))).toBe(true);
});
