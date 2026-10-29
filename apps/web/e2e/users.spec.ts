import { expect, type Page, test } from '@playwright/test';

const me = {
  id: '0192d4a0-0000-7000-8000-000000000001',
  name: 'Test Student',
  roll: '1703103',
  role: 'student',
  department: { code: '03', short: 'CSE', name: 'Computer Science & Engineering' },
  series: 2017,
  email: 'test.student@example.com',
  phone: '+8801700000001',
  showEmail: false,
  showPhone: false,
  dismissedGuides: [] as string[],
};

const other = {
  id: '0192d4a0-0000-7000-8000-000000000002',
  name: 'Other Student',
  roll: '2100045',
  role: 'alumni',
  department: { code: '00', short: 'CE', name: 'Civil Engineering' },
  series: 2021,
  email: 'other.student@example.com',
  phone: null,
};

/** Stands in for the API so the flow runs without a database (the API has its own e2e tests). */
async function mockApi(page: Page) {
  const profile = { ...me, dismissedGuides: [...me.dismissedGuides] };
  const calls: { method: string; path: string; body: unknown }[] = [];
  const json = (status: number, body: unknown) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const body: unknown = request.postDataJSON();
    calls.push({ method: request.method(), path, body });
    const key = `${request.method()} ${path}`;
    switch (key) {
      case 'GET /features':
        return route.fulfill(json(200, { modules: ['auth', 'users'] }));
      case 'GET /auth/session':
        return route.fulfill(
          json(200, { user: { id: me.id, name: me.name, roll: me.roll, role: me.role } }),
        );
      case 'GET /users/me':
        return route.fulfill(json(200, profile));
      case 'PATCH /users/me':
        Object.assign(profile, body);
        return route.fulfill(json(200, profile));
      case 'PATCH /users/me/guides':
        profile.dismissedGuides.push((body as { moduleKey: string }).moduleKey);
        return route.fulfill(json(200, { dismissedGuides: profile.dismissedGuides }));
      case `GET /users/${other.id}`:
        return route.fulfill(json(200, other));
      default:
        return route.fulfill(
          json(404, { error: { code: 'NOT_FOUND', message: 'User not found.' } }),
        );
    }
  });
  return calls;
}

test('view my profile, close the intro for good, and share my email', async ({ page }) => {
  const calls = await mockApi(page);

  await page.goto('/profile');
  const guide = page.getByRole('dialog');
  await expect(guide.getByText('This is your profile')).toBeVisible();
  await guide.getByRole('button', { name: 'Skip' }).click();
  await expect(guide).toBeHidden();
  // Stored on the server, so it stays closed on every device.
  expect(calls).toContainEqual({
    method: 'PATCH',
    path: '/users/me/guides',
    body: { moduleKey: 'users' },
  });

  await expect(page.getByRole('heading', { level: 2, name: me.name })).toBeVisible();
  await expect(page.getByText('Computer Science & Engineering (CSE)')).toBeVisible();
  await expect(page.getByText('2017')).toBeVisible();

  const showEmail = page.getByRole('checkbox', { name: 'Show my email to other members' });
  await expect(showEmail).not.toBeChecked();
  await showEmail.check();
  await expect(page.getByText('Saved.')).toBeVisible();
  await expect(showEmail).toBeChecked();
  expect(calls).toContainEqual({ method: 'PATCH', path: '/users/me', body: { showEmail: true } });
});

test("another member's profile shows only what they share", async ({ page }) => {
  await mockApi(page);

  await page.goto(`/users/${other.id}`);
  await expect(page.getByRole('heading', { level: 2, name: other.name })).toBeVisible();
  await expect(page.getByText('Alumni')).toBeVisible();
  await expect(page.getByText(other.email)).toBeVisible();
  await expect(page.getByText('Not shared')).toBeVisible();
});

test('an unknown member shows a clear message', async ({ page }) => {
  await mockApi(page);
  await page.goto('/users/0192d4a0-0000-7000-8000-00000000dead');
  await expect(page.getByText('This member could not be found.', { exact: false })).toBeVisible();
});
