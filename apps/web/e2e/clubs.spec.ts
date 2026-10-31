import { expect, type Page, test } from '@playwright/test';

const STUDENT = {
  id: '0192d4a0-0000-7000-8000-000000000001',
  name: 'Demo Student',
  role: 'student',
};
const MANAGER = {
  id: '0192d4a0-0000-7000-8000-000000000003',
  name: 'Sadia Sample',
  role: 'club_manager',
};
const CLUB_ID = '0192d4a0-0000-7000-8000-0000000000b1';

const json = (status: number, body: unknown) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/** Stands in for the API (which has its own e2e tests for every rule). */
async function mockApi(page: Page, viewer: typeof STUDENT) {
  let studentState: 'none' | 'pending' | 'active' = 'none';
  const isManager = viewer.id === MANAGER.id;
  const summary = () => ({
    id: CLUB_ID,
    slug: 'robotics-club-demo',
    name: 'Robotics Club (demo)',
    tagline: 'Build robots, learn embedded systems.',
    category: 'technical',
    logo: null,
    memberCount: studentState === 'active' ? 2 : 1,
    myMembership: isManager
      ? { role: 'manager', state: 'active' }
      : studentState === 'none'
        ? null
        : { role: 'member', state: studentState },
    moderated: false,
  });
  const detail = () => ({
    ...summary(),
    about: 'Weekly workshops and contests.',
    cover: null,
    contactEmail: 'robotics@example.com',
    links: [{ label: 'Facebook page', url: 'https://example.com/robotics' }],
    managers: [MANAGER],
    canEdit: isManager,
    canEditDetails: isManager,
  });

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const key = `${request.method()} ${path}`;

    if (key === 'GET /features') {
      return route.fulfill(json(200, { modules: ['auth', 'users', 'clubs', 'news', 'admin'] }));
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
          dismissedGuides: ['clubs'],
        }),
      );
    }
    if (key === 'GET /clubs') {
      const q = url.searchParams.get('q')?.toLowerCase() ?? '';
      const items = 'robotics club'.includes(q) ? [summary()] : [];
      return route.fulfill(json(200, { items, nextCursor: null }));
    }
    if (key === 'GET /clubs/mine') {
      return route.fulfill(json(200, summary().myMembership ? [summary()] : []));
    }
    if (key === 'GET /clubs/robotics-club-demo') return route.fulfill(json(200, detail()));
    if (key === `POST /clubs/${CLUB_ID}/membership`) {
      studentState = 'pending';
      return route.fulfill(json(201, detail()));
    }
    if (key === `GET /clubs/${CLUB_ID}/members`) {
      const state = url.searchParams.get('state');
      const people =
        state === 'pending'
          ? studentState === 'pending'
            ? [
                {
                  ...STUDENT,
                  roll: '1703999',
                  clubRole: 'member',
                  state: 'pending',
                  since: '2026-10-26T09:45:00.000Z',
                },
              ]
            : []
          : [
              {
                ...MANAGER,
                roll: '2202904',
                clubRole: 'manager',
                state: 'active',
                since: '2026-10-20T09:45:00.000Z',
              },
            ];
      return route.fulfill(json(200, { items: people, nextCursor: null }));
    }
    if (key === `POST /clubs/${CLUB_ID}/members/${STUDENT.id}/approve`) {
      studentState = 'active';
      return route.fulfill({ status: 204 });
    }
    return route.fulfill(json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
  });
}

test('a student finds a club and asks to join', async ({ page }) => {
  await mockApi(page, STUDENT);
  await page.goto('/clubs');
  await page.getByRole('searchbox', { name: 'Search clubs' }).fill('robot');
  await page.getByRole('link', { name: 'Robotics Club (demo)' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Robotics Club (demo)' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'robotics@example.com' })).toBeVisible();
  await page.getByRole('button', { name: 'Ask to join' }).click();
  await expect(page.getByText('Request sent')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel request' })).toBeVisible();
});

test('a manager approves a join request', async ({ page }) => {
  await mockApi(page, MANAGER);
  // The student asked to join before the manager opened the page.
  await page.route(`**/api/v1/clubs/${CLUB_ID}/members?state=pending`, (route) =>
    route.fulfill(
      json(200, {
        items: [
          {
            ...STUDENT,
            roll: '1703999',
            clubRole: 'member',
            state: 'pending',
            since: '2026-10-26T09:45:00.000Z',
          },
        ],
        nextCursor: null,
      }),
    ),
  );
  await page.goto('/clubs/robotics-club-demo');
  await page.getByRole('link', { name: 'Members and requests' }).click();

  const request = page.getByRole('listitem').filter({ hasText: 'Demo Student' });
  await expect(request).toBeVisible();
  const approve = page.waitForRequest(`**/clubs/${CLUB_ID}/members/${STUDENT.id}/approve`);
  await request.getByRole('button', { name: 'Approve' }).click();
  await approve;
});
