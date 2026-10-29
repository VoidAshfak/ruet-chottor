import { expect, type Page, test } from '@playwright/test';

const member = (n: number, name: string, roll: string, extra: object = {}) => ({
  id: `0192d4a0-0000-7000-8000-00000000000${n}`,
  name,
  roll,
  role: 'student',
  department: {
    code: roll.slice(2, 4),
    short: roll.slice(2, 4) === '03' ? 'CSE' : 'EEE',
    name: '',
  },
  series: 2000 + Number(roll.slice(0, 2)),
  email: null,
  phone: null,
  ...extra,
});

const members = [
  member(1, 'Arif Placeholder', '1703901', { email: 'arif.placeholder@example.com' }),
  member(2, 'Nusrat Example', '1701902'),
  member(3, 'Rafiq Fakeuddin', '2103903'),
];

/** Stands in for the API: filters the fake members like the real endpoint (which has its own e2e tests). */
async function mockApi(page: Page) {
  const searches: URLSearchParams[] = [];
  const json = (status: number, body: unknown) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    switch (path) {
      case '/features':
        return route.fulfill(json(200, { modules: ['auth', 'users', 'directory'] }));
      case '/auth/session':
        return route.fulfill(
          json(200, { user: { id: 'me', name: 'Me', roll: '1703100', role: 'student' } }),
        );
      case '/users/me':
        return route.fulfill(
          json(200, {
            ...member(9, 'Me', '1703100'),
            email: 'me@example.com',
            phone: '+8801700000009',
            showEmail: false,
            showPhone: false,
            dismissedGuides: ['directory'],
          }),
        );
      case '/directory': {
        searches.push(url.searchParams);
        const q = url.searchParams.get('q')?.toLowerCase() ?? '';
        const department = url.searchParams.get('department');
        const items = members.filter(
          (m) =>
            (m.name.toLowerCase().includes(q) || m.roll.startsWith(q)) &&
            (!department || m.department.short === department),
        );
        return route.fulfill(json(200, { items, nextCursor: null }));
      }
      default:
        return route.fulfill(json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
    }
  });
  return searches;
}

test('search the directory by name and department', async ({ page }) => {
  const searches = await mockApi(page);

  await page.goto('/directory');
  await expect(page.getByRole('heading', { level: 1, name: 'Directory' })).toBeVisible();
  await expect(page.getByText('3 members')).toBeVisible();
  // Shared contact details appear; hidden ones do not.
  await expect(page.getByText('arif.placeholder@example.com')).toBeVisible();

  await page.getByRole('searchbox', { name: 'Name or roll' }).fill('rafiq');
  await expect(page.getByText('1 member', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/q=rafiq/);

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByText('3 members')).toBeVisible();

  await page.getByLabel('Department', { exact: true }).selectOption('EEE');
  await expect(page.getByText('1 member', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nusrat Example' })).toHaveAttribute(
    'href',
    '/users/0192d4a0-0000-7000-8000-000000000002',
  );
  expect(searches.at(-1)?.get('department')).toBe('EEE');

  await page.getByLabel('Department', { exact: true }).selectOption('');
  await page.getByRole('searchbox', { name: 'Name or roll' }).fill('nobody');
  await expect(page.getByText(/No members match/)).toBeVisible();
});
