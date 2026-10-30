import { expect, type Page, test } from '@playwright/test';

const STUDENT = {
  id: '0192d4a0-0000-7000-8000-000000000001',
  name: 'Demo Student',
  role: 'student',
};
const MODERATOR = {
  id: '0192d4a0-0000-7000-8000-000000000002',
  name: 'Demo Moderator',
  role: 'moderator',
};
const ASSET_ID = '0192d4a0-0000-7000-8000-0000000000f1';
const POST_ID = '0192d4a0-0000-7000-8000-0000000000e1';
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

/** Stands in for the API and Cloudinary (both have their own tests). */
async function mockApi(page: Page, viewer: typeof STUDENT) {
  const posts: Record<string, unknown>[] = [];
  const cloudinaryUploads: string[] = [];
  const asset = {
    id: ASSET_ID,
    kind: 'image',
    format: 'png',
    bytes: PNG.length,
    width: 1,
    height: 1,
    url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_1600/x',
    thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,w_480,h_320/x',
  };

  await page.route('https://api.cloudinary.com/**', async (route) => {
    cloudinaryUploads.push(route.request().url());
    return route.fulfill(json(200, { public_id: 'x' }));
  });
  await page.route('https://res.cloudinary.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
  );
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const key = `${request.method()} ${path}`;

    if (key === 'GET /features') {
      return route.fulfill(
        json(200, { modules: ['auth', 'users', 'news', 'admin', 'moderation'] }),
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
          dismissedGuides: ['news'],
        }),
      );
    }
    if (key === 'POST /media/uploads') {
      return route.fulfill(
        json(201, {
          assetId: ASSET_ID,
          uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
          fields: { public_id: 'x', timestamp: '1', api_key: 'k', signature: 's' },
          maxBytes: 10485760,
        }),
      );
    }
    if (key === `POST /media/uploads/${ASSET_ID}/complete`) return route.fulfill(json(200, asset));
    if (key === 'POST /news') {
      const body = request.postDataJSON() as { title: string; category: string; body: string };
      const post = {
        id: POST_ID,
        ...body,
        media: [asset],
        author: STUDENT,
        review: 'pending',
        reviewNote: null,
        moderated: false,
        publishedAt: null,
        createdAt: '2026-10-26T09:45:00.000Z',
        updatedAt: '2026-10-26T09:45:00.000Z',
      };
      posts.push(post);
      return route.fulfill(json(201, post));
    }
    if (key === `GET /news/${POST_ID}`) return route.fulfill(json(200, posts[0]));
    if (key === 'GET /news/mine' || key === 'GET /news/review') {
      return route.fulfill(
        json(200, { items: posts.filter((p) => p.review === 'pending'), nextCursor: null }),
      );
    }
    if (key === 'GET /news') {
      return route.fulfill(
        json(200, { items: posts.filter((p) => p.review === 'approved'), nextCursor: null }),
      );
    }
    if (key === `POST /news/${POST_ID}/approve`) {
      Object.assign(posts[0]!, { review: 'approved', publishedAt: '2026-10-26T10:00:00.000Z' });
      return route.fulfill(json(200, posts[0]));
    }
    return route.fulfill(json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
  });
  return { posts, cloudinaryUploads };
}

test('a student writes a post with a photo and sends it for review', async ({ page }) => {
  const { posts, cloudinaryUploads } = await mockApi(page, STUDENT);
  await page.goto('/news');
  await expect(page.getByText('No news here yet.')).toBeVisible();
  await page.getByRole('link', { name: 'Write a post' }).click();

  await expect(page.getByText(/A moderator checks posts from members/)).toBeVisible();
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('Titles need at least 5 characters')).toBeVisible();

  await page.getByRole('textbox', { name: 'Title' }).fill('Central library open until 10 PM');
  await page.getByRole('combobox', { name: 'Category' }).selectOption('announcement');
  await page
    .getByRole('textbox', { name: 'Post' })
    .fill('During exam week the central library stays open until 10 PM, Sunday to Thursday.');
  await page.locator('input[type=file]').setInputFiles({
    name: 'notice.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(page.getByRole('img', { name: 'Attached image 1' })).toBeVisible();
  expect(cloudinaryUploads).toEqual(['https://api.cloudinary.com/v1_1/demo/image/upload']);

  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(page).toHaveURL(new RegExp(`/news/${POST_ID}$`));
  await expect(page.getByText('Waiting for review.')).toBeVisible();
  expect(posts[0]).toMatchObject({ category: 'announcement', media: [{ id: ASSET_ID }] });
});

test('a moderator approves a waiting post', async ({ page }) => {
  const { posts } = await mockApi(page, MODERATOR);
  posts.push({
    id: POST_ID,
    title: 'Central library open until 10 PM',
    category: 'announcement',
    body: 'During exam week the central library stays open until 10 PM.',
    media: [],
    author: STUDENT,
    review: 'pending',
    reviewNote: null,
    moderated: false,
    publishedAt: null,
    createdAt: '2026-10-26T09:45:00.000Z',
    updatedAt: '2026-10-26T09:45:00.000Z',
  });
  await page.goto('/admin/news');
  await expect(
    page.getByRole('link', { name: 'Central library open until 10 PM', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('No posts are waiting for review.')).toBeVisible();

  await page.goto('/news');
  await expect(
    page.getByRole('link', { name: 'Central library open until 10 PM', exact: true }),
  ).toBeVisible();
});
