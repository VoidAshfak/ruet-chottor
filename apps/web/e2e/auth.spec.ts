import { expect, type Page, test } from '@playwright/test';

const user = { id: 'u-1', name: 'Test Student', roll: '2103001', role: 'student' };

/** Stands in for the API so the flow runs without a database (the API has its own e2e tests). */
async function mockApi(page: Page) {
  let loggedIn = false;
  const json = (status: number, body: unknown) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
  const unauthorized = { error: { code: 'UNAUTHORIZED', message: 'Please log in to continue.' } };

  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const body = route.request().postDataJSON() as Record<string, string> | null;
    switch (path) {
      case '/features':
        return route.fulfill(json(200, { modules: ['auth'] }));
      case '/auth/session':
        return route.fulfill(loggedIn ? json(200, { user }) : json(401, unauthorized));
      case '/auth/refresh':
        return route.fulfill(json(401, unauthorized));
      case '/auth/signup':
        return route.fulfill(json(201, { user }));
      case '/auth/login':
        return route.fulfill(
          json(200, {
            challengeId: 'challenge-1',
            channel: 'email',
            destination: 't•••@example.com',
            expiresInSeconds: 300,
            resendInSeconds: 60,
          }),
        );
      case '/auth/otp/verify':
        if (body?.code !== '123456') {
          return route.fulfill(
            json(400, { error: { code: 'OTP_INVALID', message: 'Wrong code. 4 tries left.' } }),
          );
        }
        loggedIn = true;
        return route.fulfill(json(200, { user }));
      case '/auth/logout':
        loggedIn = false;
        return route.fulfill({ status: 204 });
      default:
        return route.fulfill(json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
    }
  });
}

test('sign up, log in with the emailed code, then log out', async ({ page }) => {
  await mockApi(page);

  await page.goto('/signup');
  await page.getByRole('dialog').getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Create your account' })).toBeVisible();

  // Client-side validation from the shared schema.
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Roll must be 7 digits, e.g. 1703103')).toBeVisible();

  await page.getByLabel('Full name', { exact: true }).fill(user.name);
  await page.getByLabel('Roll', { exact: true }).fill(user.roll);
  await page.getByLabel('Registration number', { exact: true }).fill('12345');
  await page.getByLabel('Email', { exact: true }).fill('test.student@example.com');
  await page.getByLabel('Phone', { exact: true }).fill('01700000001');
  await page.getByLabel('Date of birth', { exact: true }).fill('2003-05-14');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText(/too common/)).toBeVisible();

  await page.getByLabel('Password', { exact: true }).fill('green-river-42');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Login page, roll pre-filled.
  await expect(page).toHaveURL(/\/login\?created=2103001/);
  await expect(page.getByText('Account created. Log in to continue.')).toBeVisible();
  await expect(page.getByLabel('Roll', { exact: true })).toHaveValue(user.roll);
  await page.getByLabel('Password', { exact: true }).fill('green-river-42');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('We sent a 6-digit code to t•••@example.com.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Send a new code in \d+s/ })).toBeDisabled();

  await page.getByLabel('6-digit code', { exact: true }).fill('000000');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Wrong code' })).toHaveText(
    'Wrong code. 4 tries left.',
  );

  await page.getByLabel('6-digit code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await expect(page).toHaveURL('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Skip' }).click(); // home intro
  const header = page.getByRole('banner').first();
  await expect(header.getByRole('button', { name: 'Log out' })).toBeVisible();

  await header.getByRole('button', { name: 'Log out' }).click();
  await expect(header.getByRole('link', { name: 'Log in' })).toBeVisible();
});

test('auth pages work at phone width without horizontal scrolling', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/signup');
  await page.getByRole('dialog').getByRole('button', { name: 'Skip' }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
