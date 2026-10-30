import { expect, test } from '@playwright/test';

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
  await expect(page.getByRole('heading', { name: 'Sections' })).toBeVisible();
  await expect(page.getByText('Lost & Found', { exact: true })).toBeVisible();

  // The guide stays dismissed after a reload.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('info tips explain things on tap or click', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Skip' }).click();

  await page.getByRole('button', { name: 'More info' }).click();
  await expect(page.getByText(/Sections are added one at a time/)).toBeVisible();
});
