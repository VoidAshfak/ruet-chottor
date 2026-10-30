import { expect, test } from '@playwright/test';

test('pages are sent with security headers', async ({ page }) => {
  await page.route('**/api/v1/**', (route) => route.abort());
  const response = await page.goto('/');
  const headers = response!.headers();

  const csp = headers['content-security-policy'] ?? '';
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain('https://res.cloudinary.com');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['x-powered-by']).toBeUndefined();
});
