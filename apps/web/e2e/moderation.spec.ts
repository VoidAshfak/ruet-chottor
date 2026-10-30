import { expect, type Page, test } from '@playwright/test';

const ME = { id: '0192d4a0-0000-7000-8000-000000000001', name: 'Me Sample', role: 'student' };
const NUSRAT = {
  id: '0192d4a0-0000-7000-8000-000000000002',
  name: 'Nusrat Example',
  role: 'student',
};
const MODERATOR = { id: '0192d4a0-0000-7000-8000-000000000009', name: 'Demo Moderator' };
const CHAT_ID = '0192d4a0-0000-7000-8000-0000000000c1';
const MESSAGE_ID = '0192d4a0-0000-7000-8000-0000000001a1';
const BODY = 'Cheap exam answers at example.com';

const json = (status: number, body: unknown) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/** Stands in for the API (which has its own e2e tests for every rule). */
async function mockApi(page: Page, role: 'student' | 'moderator') {
  const reports: unknown[] = [];
  let status = 'visible';
  const history: object[] = [];
  const queueItem = () => ({
    contentType: 'chat.message',
    contentId: MESSAGE_ID,
    label: 'Chat message',
    context: 'Group chat',
    preview: BODY,
    contentStatus: status,
    author: { id: NUSRAT.id, name: NUSRAT.name, roll: '2103902' },
    reportCount: 2,
    reasons: [{ reason: 'scam', count: 2 }],
    firstReportedAt: '2026-10-26T09:45:00.000Z',
    lastReportedAt: '2026-10-26T09:50:00.000Z',
  });
  const detail = () => ({
    item: queueItem(),
    reports: [
      {
        id: 'report-1',
        reason: 'scam',
        note: 'Sent to the whole group',
        status: status === 'visible' ? 'open' : 'actioned',
        reporter: { id: ME.id, name: ME.name, roll: '1703100' },
        createdAt: '2026-10-26T09:45:00.000Z',
      },
    ],
    history,
  });

  await page.route('**/socket.io/**', (route) => route.abort());
  await page.routeWebSocket(/socket\.io/, (ws) => ws.close());
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const key = `${request.method()} ${path}`;

    if (key === 'GET /features') {
      return route.fulfill(
        json(200, { modules: ['auth', 'users', 'chat', 'admin', 'moderation'] }),
      );
    }
    if (key === 'GET /auth/session') {
      const user = role === 'moderator' ? { ...MODERATOR, role } : ME;
      return route.fulfill(json(200, { user: { ...user, roll: '1703100' } }));
    }
    if (key === 'GET /users/me') {
      return route.fulfill(
        json(200, {
          ...ME,
          roll: '1703100',
          department: null,
          series: 2017,
          email: 'me@example.com',
          phone: '+8801700000001',
          showEmail: false,
          showPhone: false,
          dismissedGuides: ['chat'],
        }),
      );
    }
    if (key === `GET /chat/conversations/${CHAT_ID}`) {
      return route.fulfill(
        json(200, {
          id: CHAT_ID,
          type: 'group',
          name: 'Study group',
          members: [
            { ...ME, conversationRole: 'owner' },
            { ...NUSRAT, conversationRole: 'member' },
          ],
          myRole: 'owner',
          lastMessage: null,
          lastMessageAt: '2026-10-26T09:45:00.000Z',
          unreadCount: 0,
        }),
      );
    }
    if (key === `GET /chat/conversations/${CHAT_ID}/messages`) {
      return route.fulfill(
        json(200, {
          items: [
            {
              id: MESSAGE_ID,
              conversationId: CHAT_ID,
              sender: NUSRAT,
              body: BODY,
              deleted: false,
              moderated: false,
              createdAt: '2026-10-26T09:45:00.000Z',
            },
          ],
          nextCursor: null,
        }),
      );
    }
    if (key === `POST /chat/conversations/${CHAT_ID}/read`) return route.fulfill({ status: 204 });
    if (key === 'GET /moderation/reports/mine') {
      return route.fulfill(json(200, { reportedIds: [] }));
    }
    if (key === 'POST /moderation/reports') {
      reports.push(request.postDataJSON());
      return route.fulfill({ status: 204 });
    }
    if (key === 'GET /moderation/queue') {
      return route.fulfill(
        json(200, { items: status === 'visible' ? [queueItem()] : [], nextCursor: null }),
      );
    }
    if (key === `GET /moderation/items/chat.message/${MESSAGE_ID}`) {
      return route.fulfill(json(200, detail()));
    }
    if (key === `POST /moderation/items/chat.message/${MESSAGE_ID}/hide`) {
      status = 'hidden';
      history.unshift({
        id: 'log-1',
        action: 'hide_content',
        moderator: { ...MODERATOR, roll: '0000002' },
        targetUser: { id: NUSRAT.id, name: NUSRAT.name, roll: '2103902' },
        contentType: 'chat.message',
        contentId: MESSAGE_ID,
        reason: (request.postDataJSON() as { reason: string }).reason,
        details: { reports: 2 },
        createdAt: '2026-10-26T10:00:00.000Z',
      });
      return route.fulfill(json(200, detail()));
    }
    return route.fulfill(json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
  });
  return reports;
}

test('report a chat message', async ({ page }) => {
  const reports = await mockApi(page, 'student');
  await page.goto(`/chat/${CHAT_ID}`);
  await expect(page.getByText(BODY)).toBeVisible();

  await page.getByRole('button', { name: 'Report this message' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(dialog.getByText('Pick a reason')).toBeVisible();
  await dialog.getByRole('radio', { name: 'Scam or fraud' }).check();
  await dialog.getByRole('textbox', { name: 'Note (optional)' }).fill('Sent to the whole group');
  await dialog.getByRole('button', { name: 'Send report' }).click();

  await expect(page.getByText('Thanks. The moderators will take a look.')).toBeVisible();
  expect(reports).toEqual([
    {
      contentType: 'chat.message',
      contentId: MESSAGE_ID,
      reason: 'scam',
      note: 'Sent to the whole group',
    },
  ]);
});

test('a moderator hides a reported message from the queue', async ({ page }) => {
  await mockApi(page, 'moderator');
  await page.goto('/admin/moderation');
  await expect(page.getByText(BODY)).toBeVisible();
  await expect(page.getByText('2 reports')).toBeVisible();

  await page.getByRole('link', { name: 'Review' }).click();
  await expect(page.getByText('Reported by Me Sample')).toBeVisible();
  await page.getByRole('button', { name: 'Hide', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Reason for this action' }).fill('Scam link');
  await dialog.getByRole('button', { name: 'Hide', exact: true }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Hidden', { exact: true })).toBeVisible();
  await expect(page.getByText('Scam link')).toBeVisible();
});
