import { describe, expect, it } from 'vitest';
import { createGroupRequestSchema, sendMessageRequestSchema } from './schemas.js';
import { chatSendPayloadSchema } from './socket-schemas.js';

const uuid = (n: number) => `0190f0e0-0000-7000-8000-${String(n).padStart(12, '0')}`;

describe('chat schemas', () => {
  it('trims messages and rejects empty or over-long ones', () => {
    expect(sendMessageRequestSchema.parse({ body: '  Hi  ' }).body).toBe('Hi');
    expect(sendMessageRequestSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(sendMessageRequestSchema.safeParse({ body: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('rejects unknown fields, so clients cannot set the sender', () => {
    expect(sendMessageRequestSchema.safeParse({ body: 'Hi', senderId: uuid(1) }).success).toBe(
      false,
    );
  });

  it('limits groups to 50 members and no duplicates', () => {
    const ids = (count: number) => Array.from({ length: count }, (_, i) => uuid(i));
    expect(createGroupRequestSchema.safeParse({ name: 'G', memberIds: ids(49) }).success).toBe(
      true,
    );
    expect(createGroupRequestSchema.safeParse({ name: 'G', memberIds: ids(50) }).success).toBe(
      false,
    );
    expect(
      createGroupRequestSchema.safeParse({ name: 'G', memberIds: [uuid(1), uuid(1)] }).success,
    ).toBe(false);
  });

  it('needs a valid conversation id on socket sends', () => {
    expect(chatSendPayloadSchema.safeParse({ conversationId: 'room-1', body: 'Hi' }).success).toBe(
      false,
    );
    expect(chatSendPayloadSchema.safeParse({ conversationId: uuid(1), body: 'Hi' }).success).toBe(
      true,
    );
  });
});
