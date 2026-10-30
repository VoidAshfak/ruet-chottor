import { expect, type Page, test } from '@playwright/test';

const SELLER = {
  id: '0192d4a0-0000-7000-8000-000000000001',
  name: 'Rafiq Sample',
  role: 'student',
};
const BUYER = {
  id: '0192d4a0-0000-7000-8000-000000000002',
  name: 'Nusrat Example',
  role: 'student',
};
const LISTING_ID = '0192d4a0-0000-7000-8000-0000000000c1';

const json = (status: number, body: unknown) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

const listing = (overrides: Record<string, unknown> = {}) => ({
  id: LISTING_ID,
  title: 'Casio fx-991EX calculator',
  category: 'electronics',
  condition: 'like_new',
  priceTaka: 120000,
  description: 'Used for one term.',
  meetPlace: 'cafeteria',
  meetDetail: 'Near the tea stall',
  photos: [],
  seller: SELLER,
  state: 'available',
  expired: false,
  expiresAt: '2030-11-27T00:00:00.000Z',
  moderated: false,
  heldFor: null,
  isMine: false,
  createdAt: '2026-10-28T09:45:00.000Z',
  ...overrides,
});

/** Stands in for the API (which has its own e2e tests for every rule). */
async function mockApi(page: Page, viewer: typeof SELLER) {
  const searches: URLSearchParams[] = [];
  const created: Record<string, unknown>[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const key = `${request.method()} ${path}`;

    if (key === 'GET /features') {
      return route.fulfill(
        json(200, { modules: ['auth', 'users', 'chat', 'marketplace', 'admin', 'moderation'] }),
      );
    }
    if (key === 'GET /auth/session') {
      return route.fulfill(json(200, { user: { ...viewer, roll: '1703999' } }));
    }
    if (key === 'GET /users/me') {
      return route.fulfill(
        json(200, {
          ...viewer,
          roll: '1703999',
          department: null,
          series: 2017,
          email: 'demo@example.com',
          phone: '+8801700000001',
          showEmail: false,
          showPhone: false,
          dismissedGuides: ['marketplace'],
        }),
      );
    }
    if (key === 'GET /marketplace/listings') {
      searches.push(url.searchParams);
      const free = url.searchParams.get('maxPrice') === '0';
      const items = free
        ? [
            listing({
              id: '0192d4a0-0000-7000-8000-0000000000c2',
              title: 'Old physics notes',
              priceTaka: 0,
            }),
          ]
        : [listing()];
      return route.fulfill(json(200, { items, nextCursor: null }));
    }
    if (key === `GET /marketplace/listings/${LISTING_ID}`) {
      return route.fulfill(
        json(
          200,
          created[0]
            ? {
                ...listing(),
                ...created[0],
                isMine: true,
                moderated: true,
                heldFor: 'question paper',
              }
            : listing(),
        ),
      );
    }
    if (key === 'GET /moderation/reports/mine')
      return route.fulfill(json(200, { reportedIds: [] }));
    if (key === 'POST /marketplace/listings') {
      created.push(request.postDataJSON() as Record<string, unknown>);
      return route.fulfill(json(201, { ...listing(), ...created[0], isMine: true }));
    }
    return route.fulfill(json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
  });
  return { searches, created };
}

test('a buyer filters the marketplace and opens a listing', async ({ page }) => {
  const { searches } = await mockApi(page, BUYER);
  await page.goto('/marketplace');

  await page.getByRole('checkbox', { name: 'Free only' }).check();
  await expect(page.getByRole('link', { name: /Old physics notes/ })).toBeVisible();
  expect(searches.at(-1)?.get('maxPrice')).toBe('0');
  await page.getByRole('checkbox', { name: 'Free only' }).uncheck();

  await page.getByRole('link', { name: /Casio fx-991EX calculator/ }).click();
  // Bangladeshi digit grouping.
  // The browse page stays mounted but hidden after navigating, and its card shows the price too.
  await expect(page.getByText('৳1,20,000').filter({ visible: true })).toBeVisible();
  await expect(
    page.getByText('Pay in person when you see the item. Never send money in advance.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Send a message to ${SELLER.name}` }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Report this listing' })).toBeVisible();
});

test('a listing that mentions a prohibited item waits for a moderator', async ({ page }) => {
  const { created } = await mockApi(page, SELLER);
  await page.goto('/marketplace');
  await page.getByRole('link', { name: 'Sell something' }).click();

  await page.getByText('Not allowed on the marketplace').click();
  await expect(page.getByText('Exam questions, answers or leaked papers')).toBeVisible();

  await page.getByRole('textbox', { name: 'What are you selling?' }).fill('EEE question paper set');
  await page.getByRole('combobox', { name: 'Category' }).selectOption('books');
  await page.getByRole('combobox', { name: 'Condition' }).selectOption('good');
  await page.getByRole('spinbutton', { name: 'Price (৳)' }).fill('200');
  await page.getByRole('combobox', { name: 'Where to meet' }).selectOption('central_library');
  await page.getByRole('button', { name: 'Post listing' }).click();

  await expect(page).toHaveURL(new RegExp(`/marketplace/${LISTING_ID}$`));
  expect(created[0]).toMatchObject({ priceTaka: 200, meetPlace: 'central_library' });
  await expect(
    page.getByText(/Waiting for a moderator: it mentions “question paper”/),
  ).toBeVisible();
});
