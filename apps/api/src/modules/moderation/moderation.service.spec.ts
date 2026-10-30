import { describe, expect, it } from 'vitest';
import type { Report } from '../../generated/prisma/client.js';
import { groupReports } from './moderation.service.js';

let next = 0;
const report = (contentId: string, minutesAgo: number): Report => ({
  id: `r${(next += 1)}`,
  contentType: 'chat.message',
  contentId,
  reporterId: `u${next}`,
  reason: 'spam',
  note: null,
  status: 'open',
  resolvedById: null,
  resolvedAt: null,
  createdAt: new Date(Date.now() - minutesAgo * 60_000),
});

describe('groupReports', () => {
  it('puts the most-reported items first, then the longest waiting', () => {
    const reports = [
      report('quiet-new', 1),
      report('busy', 5),
      report('busy', 4),
      report('quiet-old', 30),
      report('busy', 3),
    ];
    expect(groupReports(reports, 'open').map((g) => [g.contentId, g.reports.length])).toEqual([
      ['busy', 3],
      ['quiet-old', 1],
      ['quiet-new', 1],
    ]);
  });

  it('shows the most recently reported first for closed reports', () => {
    const reports = [report('older', 60), report('newer', 2)];
    expect(groupReports(reports, 'actioned').map((g) => g.contentId)).toEqual(['newer', 'older']);
  });
});
