import { expect, type Page, test } from '@playwright/test';

const ME = { id: '0192d4a0-0000-7000-8000-000000000001', name: 'Me Sample', role: 'student' };
const NUSRAT = {
  id: '0192d4a0-0000-7000-8000-000000000002',
  name: 'Nusrat Example',
  role: 'student',
};
const CHAT_ID = '0192d4a0-0000-7000-8000-0000000000c1';

type Message = {
  id: string;
  conversationId: string;
  sender: typeof ME;
  body: string | null;
  deleted: boolean;
  moderated: boolean;
  createdAt: string;
};

/**
 * Stands in for the API (which has its own e2e tests, sockets included). The socket is blocked,
 * so the page falls back to sending over HTTP, exactly as when a connection drops.
 */
async function mockApi(page: Page, { unread = 0 } = {}) {
  const messages: Message[] = [];
  let started = false;
  const json = (status: number, body: unknown) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
  const conversation = () => ({
    id: CHAT_ID,
    type: 'direct',
    name: null,
    members: [
      { ...ME, conversationRole: 'member' },
      { ...NUSRAT, conversationRole: 'member' },
    ],
    myRole: 'member',
    lastMessage: messages.at(-1) ?? null,
    lastMessageAt: new Date('2026-10-26T09:45:00Z').toISOString(),
    unreadCount: unread,
  });

  await page.route('**/socket.io/**', (route) => route.abort());
  await page.routeWebSocket(/socket\.io/, (ws) => ws.close());
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const method = request.method();

    if (path === '/features') {
      return route.fulfill(json(200, { modules: ['auth', 'users', 'directory', 'chat'] }));
    }
    if (path === '/auth/session') {
      return route.fulfill(json(200, { user: { ...ME, roll: '1703100' } }));
    }
    if (path === '/users/me') {
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
    if (path === `/users/${NUSRAT.id}`) {
      return route.fulfill(
        json(200, {
          ...NUSRAT,
          roll: '1703902',
          department: null,
          series: 2017,
          email: null,
          phone: null,
        }),
      );
    }
    if (path === '/chat/conversations') {
      return route.fulfill(json(200, { items: started ? [conversation()] : [], nextCursor: null }));
    }
    if (path === '/chat/conversations/direct' && method === 'POST') {
      started = true;
      return route.fulfill(json(201, conversation()));
    }
    if (path === `/chat/conversations/${CHAT_ID}`) return route.fulfill(json(200, conversation()));
    if (path === `/chat/conversations/${CHAT_ID}/read`) {
      unread = 0;
      return route.fulfill({ status: 204 });
    }
    if (path === `/chat/conversations/${CHAT_ID}/messages`) {
      if (method === 'POST') {
        const body = request.postDataJSON() as { body: string; clientId?: string };
        const message: Message = {
          id: `0192d4a0-0000-7000-8000-0000000001${String(messages.length).padStart(2, '0')}`,
          conversationId: CHAT_ID,
          sender: ME,
          body: body.body,
          deleted: false,
          moderated: false,
          createdAt: new Date('2026-10-26T09:45:00Z').toISOString(),
        };
        messages.push(message);
        return route.fulfill(json(201, { ...message, clientId: body.clientId }));
      }
      return route.fulfill(json(200, { items: messages.toReversed(), nextCursor: null }));
    }
    if (path.startsWith('/chat/messages/') && method === 'DELETE') {
      const message = messages.find((m) => path.endsWith(m.id));
      if (message) Object.assign(message, { deleted: true, body: null });
      return route.fulfill({ status: 204 });
    }
    return route.fulfill(json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
  });
}

test('message someone from their profile, then delete the message', async ({ page }) => {
  await mockApi(page);
  await page.goto(`/users/${NUSRAT.id}`);
  await page.getByRole('button', { name: `Send a message to ${NUSRAT.name}` }).click();

  await expect(page).toHaveURL(new RegExp(`/chat/${CHAT_ID}$`));
  await expect(page.getByRole('heading', { level: 1, name: NUSRAT.name })).toBeVisible();
  await expect(page.getByText('Say hello!')).toBeVisible();

  const composer = page.getByRole('textbox', { name: 'Message' });
  await composer.fill('Lab report due at 3:45 PM?');
  await composer.press('Enter');
  await expect(page.getByText('Lab report due at 3:45 PM?')).toBeVisible();
  await expect(page.getByText('Sending…')).toBeHidden();
  await expect(composer).toHaveValue('');
  await expect(page.getByText('26 Oct 2026, 3:45 PM')).toBeVisible(); // Asia/Dhaka

  await page.getByRole('button', { name: 'Delete this message' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Message deleted', { exact: true })).toBeVisible();
  await expect(page.getByText('Lab report due at 3:45 PM?')).toBeHidden();
});

test('the conversation list shows unread messages', async ({ page }) => {
  await mockApi(page, { unread: 3 });
  await page.goto('/chat');
  await expect(page.getByText(/No conversations yet/)).toBeVisible();

  await page.goto(`/users/${NUSRAT.id}`);
  await page.getByRole('button', { name: `Send a message to ${NUSRAT.name}` }).click();
  await expect(page).toHaveURL(new RegExp(`/chat/${CHAT_ID}$`));
  await page.getByRole('link', { name: /All conversations/ }).click();

  const row = page.getByRole('link', { name: new RegExp(NUSRAT.name) });
  await expect(row).toBeVisible();
  await expect(row.getByText('No messages yet')).toBeVisible();
  await expect(row.getByLabel('3 unread')).toHaveText('3');
});
