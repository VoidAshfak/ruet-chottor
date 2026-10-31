import { expect, type Page, test } from '@playwright/test';

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/** Visitors (no session) with only auth and the directory switched on. */
async function mockVisitorApi(page: Page) {
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    if (path === '/features') return route.fulfill(json({ modules: ['auth', 'directory'] }));
    if (path === '/auth/session') {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }),
      });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
}

test('home page renders without console errors (e.g. hydration mismatches)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    // The API calls are blocked below, so the failed /features fetch is expected.
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      errors.push(message.text());
    }
  });

  // Simulate an unreachable API even when a developer's API is running (`pnpm dev`).
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.goto('/');
  // The first-visit intro is modal; close it so the page behind is in the accessibility tree.
  await page.getByRole('dialog').getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('status')).toBeVisible(); // loading or offline message
  expect(errors).toEqual([]);
});

test('first visit shows the intro guide, then the home page', async ({ page }) => {
  await mockVisitorApi(page);
  await page.goto('/');

  const guide = page.getByRole('dialog');
  await expect(guide.getByText('Step 1 of 3')).toBeVisible();
  await guide.getByRole('button', { name: 'Next' }).click();
  await guide.getByRole('button', { name: 'Next' }).click();
  await guide.getByRole('button', { name: 'Done' }).click();
  await expect(guide).toBeHidden();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Welcome to RUET Chottor' }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: /Cartoon of RUET campus life/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Join with your RUET roll' })).toBeVisible();
  // Sections that are on get a card; the rest are listed as coming.
  await expect(page.getByRole('main').getByRole('link', { name: /^Directory/ })).toBeVisible();
  await expect(page.getByText('Lost & Found', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Join in three steps' })).toBeVisible();

  // The guide stays dismissed after a reload.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('info tips explain things on tap or click', async ({ page }) => {
  await mockVisitorApi(page);
  await page.goto('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Skip' }).click();

  await page.getByRole('button', { name: 'About upcoming sections' }).click();
  await expect(page.getByText(/Sections are added one at a time/)).toBeVisible();
});

test('a long name never stretches the header, and the menu opens on phones', async ({ page }) => {
  const name = 'Muhammad Abdullah Al Mamun Chowdhury Rafiqul Islam Bhuiyan';
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    if (path === '/features') {
      return route.fulfill(
        json({ modules: ['auth', 'users', 'directory', 'chat', 'news', 'clubs', 'events'] }),
      );
    }
    if (path === '/auth/session') {
      return route.fulfill(json({ user: { id: 'u1', name, roll: '1703999', role: 'student' } }));
    }
    if (path === '/users/me') {
      return route.fulfill(
        json({
          id: 'u1',
          name,
          roll: '1703999',
          role: 'student',
          department: null,
          series: 2017,
          email: 'me@example.com',
          phone: '+8801700000001',
          showEmail: false,
          showPhone: false,
          dismissedGuides: ['home', 'chat'],
        }),
      );
    }
    return route.fulfill(json({ items: [], nextCursor: null }));
  });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: /Muhammad$/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);

  await page.getByRole('button', { name: 'Open the list of sections' }).click();
  await page.getByRole('link', { name: 'Messages', exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);

  await page.getByRole('button', { name: `Account menu for ${name}` }).click();
  await expect(page.getByText(name)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
});
