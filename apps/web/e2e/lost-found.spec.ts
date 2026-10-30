import { expect, type Page, test } from '@playwright/test';

const FINDER = {
  id: '0192d4a0-0000-7000-8000-000000000001',
  name: 'Rafiq Sample',
  role: 'student',
};
const OWNER = {
  id: '0192d4a0-0000-7000-8000-000000000002',
  name: 'Nusrat Example',
  role: 'student',
};
const ITEM_ID = '0192d4a0-0000-7000-8000-0000000000a1';
// 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const json = (status: number, body: unknown) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/** Stands in for the API (which has its own e2e tests for every rule). */
async function mockApi(page: Page, viewer: typeof FINDER) {
  const created: Record<string, unknown>[] = [];
  const item = {
    id: ITEM_ID,
    kind: 'found',
    category: 'phone',
    title: 'Black phone in a blue case',
    description: 'Found on a bench, switched off.',
    place: 'central_library',
    placeDetail: 'Second floor reading room',
    happenedOn: '2026-10-28',
    verifyQuestion: 'What is the lock-screen photo?',
    photos: [
      {
        id: '0192d4a0-0000-7000-8000-0000000000f1',
        kind: 'image',
        format: 'png',
        bytes: PNG.length,
        width: 1,
        height: 1,
        url: 'https://res.cloudinary.com/demo/image/upload/x',
        thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/t/x',
      },
    ],
    poster: FINDER,
    state: 'open',
    expired: false,
    expiresAt: '2030-11-27T00:00:00.000Z',
    moderated: false,
    isMine: viewer.id === FINDER.id,
    createdAt: '2026-10-28T09:45:00.000Z',
  };

  await page.route('https://res.cloudinary.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
  );
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const key = `${request.method()} ${path}`;

    if (key === 'GET /features') {
      return route.fulfill(
        json(200, { modules: ['auth', 'users', 'chat', 'lost-found', 'admin', 'moderation'] }),
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
          dismissedGuides: ['lost-found'],
        }),
      );
    }
    if (key === 'GET /lost-found/items') {
      return route.fulfill(json(200, { items: [item], nextCursor: null }));
    }
    if (key === `GET /lost-found/items/${ITEM_ID}`) return route.fulfill(json(200, item));
    if (key === 'POST /lost-found/items') {
      const body = request.postDataJSON() as Record<string, unknown>;
      created.push(body);
      return route.fulfill(json(201, { ...item, ...body, photos: [], isMine: true }));
    }
    return route.fulfill(json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
  });
  return created;
}

test('someone who lost a phone finds it on the board and can claim it', async ({ page }) => {
  await mockApi(page, OWNER);
  await page.goto('/lost-found');
  await page.getByRole('button', { name: 'Found', exact: true }).click();
  await page.getByRole('link', { name: /Black phone in a blue case/ }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Black phone in a blue case' }),
  ).toBeVisible();
  // The finder's photo is blurred until tapped.
  await expect(page.getByRole('img', { name: 'Photo blurred to protect the owner' })).toBeVisible();
  await page.getByRole('button', { name: 'Show photo' }).click();
  await expect(page.getByRole('img', { name: 'Black phone in a blue case 1' })).toBeVisible();

  await expect(page.getByText('“What is the lock-screen photo?”')).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Send a message to ${FINDER.name}` }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Report this post' })).toBeVisible();
});

test('a finder posts a found item with a check question', async ({ page }) => {
  const created = await mockApi(page, FINDER);
  await page.goto('/lost-found');
  await page.getByRole('link', { name: 'Post an item' }).click();

  await page.getByRole('radio', { name: 'found something' }).check();
  await page.getByRole('combobox', { name: 'What is it?' }).selectOption('wallet');
  await page.getByRole('textbox', { name: 'Short title' }).fill('Brown leather wallet');
  await page.getByRole('combobox', { name: 'Where', exact: true }).selectOption('cafeteria');
  await page.getByLabel('Which day').fill('2026-10-28');
  await page
    .getByRole('textbox', { name: 'Check question for claimants (optional)' })
    .fill('What is inside?');
  await page.getByRole('button', { name: 'Post', exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/lost-found/${ITEM_ID}$`));
  expect(created[0]).toMatchObject({
    kind: 'found',
    category: 'wallet',
    place: 'cafeteria',
    happenedOn: '2026-10-28',
    verifyQuestion: 'What is inside?',
  });
});
