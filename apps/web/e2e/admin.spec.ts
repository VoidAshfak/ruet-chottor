import { expect, type Page, test } from '@playwright/test';

const target = {
  id: '0192d4a0-0000-7000-8000-000000000008',
  name: 'Spammy Sample',
  roll: '2103908',
  role: 'student',
  status: 'active',
  suspendedUntil: null as string | null,
  createdAt: '2026-10-01T04:00:00.000Z',
};
const moderator = {
  id: '0192d4a0-0000-7000-8000-000000000002',
  name: 'Demo Moderator',
  roll: '0000002',
};

/** Stands in for the API (which has its own e2e tests for every rule). */
async function mockApi(page: Page, role: 'moderator' | 'student') {
  const user = { ...target };
  const history: object[] = [];
  const calls: { method: string; path: string; body: unknown }[] = [];
  const json = (status: number, body: unknown) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const body: unknown = request.postDataJSON();
    calls.push({ method: request.method(), path, body });
    switch (`${request.method()} ${path}`) {
      case 'GET /features':
        return route.fulfill(json(200, { modules: ['auth', 'admin'] }));
      case 'GET /auth/session':
        return route.fulfill(json(200, { user: { ...moderator, role } }));
      case 'GET /admin/users':
        return route.fulfill(json(200, { items: [user], nextCursor: null }));
      case `GET /admin/users/${target.id}`:
        return route.fulfill(json(200, { user, history }));
      case `POST /admin/users/${target.id}/suspend`: {
        const { reason, days } = body as { reason: string; days: number };
        Object.assign(user, {
          status: 'suspended',
          suspendedUntil: new Date(Date.now() + days * 86_400_000).toISOString(),
        });
        history.unshift({
          id: 'log-1',
          action: 'suspend_user',
          moderator,
          targetUser: { id: user.id, name: user.name, roll: user.roll },
          contentType: null,
          contentId: null,
          reason,
          details: { days },
          createdAt: new Date().toISOString(),
        });
        return route.fulfill(json(200, { user, history }));
      }
      default:
        return route.fulfill(json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
    }
  });
  return calls;
}

test('a moderator suspends a member with a reason', async ({ page }) => {
  const calls = await mockApi(page, 'moderator');

  await page.goto('/admin');
  await page.getByRole('dialog').getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toBeVisible();
  await page.getByRole('link', { name: target.name }).click();

  await expect(page.getByRole('heading', { level: 2, name: target.name })).toBeVisible();
  await page.getByRole('button', { name: 'Suspend' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Days', { exact: true }).fill('7');
  // A reason is required before anything happens.
  await dialog.getByRole('button', { name: 'Suspend' }).click();
  await expect(dialog.getByText(/Reason must be at least/)).toBeVisible();
  expect(calls.some((call) => call.method === 'POST')).toBe(false);

  await dialog.getByLabel('Reason', { exact: true }).fill('Posting spam links in groups');
  await dialog.getByRole('button', { name: 'Suspend' }).click();
  await expect(dialog).toBeHidden();

  expect(calls).toContainEqual({
    method: 'POST',
    path: `/admin/users/${target.id}/suspend`,
    body: { reason: 'Posting spam links in groups', days: 7 },
  });
  await expect(page.getByText('Suspended until')).toBeVisible();
  await expect(page.getByText('Posting spam links in groups')).toBeVisible();
  await expect(page.getByText('Done. The action is in the moderation log.')).toBeVisible();
});

test('the admin panel is closed to normal members', async ({ page }) => {
  await mockApi(page, 'student');
  await page.goto('/admin');
  await expect(page.getByText('This page is for moderators and admins.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0);
});
